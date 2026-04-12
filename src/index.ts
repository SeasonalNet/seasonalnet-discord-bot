import process from 'node:process';

import {
  Client,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
} from 'discord.js';

import { loadSettings, requireEnv } from './core/config.js';
import { Logger } from './core/logger.js';
import { CommandRegistry } from './core/command-registry.js';
import { buildRequestContext } from './core/context.js';
import {
  BotError,
  GuildAccessError,
  GuildOnlyError,
  ScopeError,
  UpstreamServiceError,
} from './core/errors.js';
import type { AppContext } from './core/app-context.js';
import { Database } from './storage/database.js';
import { SeasonalAgentClient } from './integrations/seasonal-agent.js';
import { loadModules } from './modules/index.js';
import { errorEmbed, configureEmbeds } from './ui/embeds.js';
import { ensureScope } from './core/command-helpers.js';
import { PresenceRotator } from './core/presence.js';

const TRANSIENT_NETWORK_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }

  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTransientNetworkError(error: unknown): boolean {
  const code = getErrorCode(error);
  return code !== undefined && TRANSIENT_NETWORK_ERROR_CODES.has(code);
}

function isIgnorableInteractionResponseError(error: unknown): boolean {
  if (error instanceof DiscordAPIError) {
    return error.code === 10062 || error.code === 40060;
  }

  const code = getErrorCode(error);
  return code === '10062' || code === '40060';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loginWithRetry(client: Client, token: string, logger: Logger): Promise<void> {
  let attempt = 0;

  for (;;) {
    try {
      await client.login(token);
      return;
    } catch (error) {
      if (!isTransientNetworkError(error)) {
        throw error;
      }

      attempt += 1;
      const delayMs = Math.min(30_000, 1_000 * 2 ** Math.min(attempt - 1, 5));

      logger.warn('Discord login failed; retrying after transient network error.', {
        attempt,
        delayMs,
        code: getErrorCode(error),
        error: describeError(error),
      });

      await sleep(delayMs);
    }
  }
}

async function replyWithCommandError(
  interaction: ChatInputCommandInteraction,
  description: string,
  logger: Logger,
): Promise<void> {
  const replyPayload: InteractionReplyOptions = {
    embeds: [errorEmbed('Command Failed', description)],
    flags: 'Ephemeral',
  };

  try {
    if (interaction.deferred) {
      await interaction.editReply({ embeds: replyPayload.embeds });
      return;
    }

    if (interaction.replied) {
      await interaction.followUp(replyPayload);
      return;
    }

    await interaction.reply(replyPayload);
  } catch (error) {
    if (isIgnorableInteractionResponseError(error)) {
      logger.warn('Could not deliver command error response to Discord.', {
        error: describeError(error),
        code: getErrorCode(error),
      });
      return;
    }

    throw error;
  }
}

async function main(): Promise<void> {
  const settings = loadSettings();
  const logger = new Logger(settings.logging.level);

  // Configure embed factories with the CDN base URL before any commands run.
  configureEmbeds(settings.cdn.icon_base_url);

  const botToken = requireEnv(settings.bot.token_env);
  const seasonalAgentToken = requireEnv(settings.integrations.seasonal_agent.bot_token_env);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  const database = new Database(settings.database.path);
  const seasonalAgent = new SeasonalAgentClient(
    settings.integrations.seasonal_agent.base_url,
    seasonalAgentToken,
    settings.integrations.seasonal_agent.timeout_ms,
  );

  const appContext: AppContext = {
    client,
    settings,
    logger,
    database,
    seasonalAgent,
  };

  const registry = new CommandRegistry();
  const modules = loadModules(settings);
  for (const module of modules) {
    for (const command of module.commands ?? []) {
      registry.register(command);
    }

    module.register?.(appContext);
  }

  const rotator = new PresenceRotator(
    settings.bot.presence.activities,
    settings.bot.presence.interval_ms,
    client,
    database,
    logger,
  );

  client.once(Events.ClientReady, (readyClient) => {
    logger.info('Discord bot ready.', {
      user: readyClient.user.tag,
      guilds: readyClient.guilds.cache.size,
    });

    readyClient.user.setStatus(settings.bot.status);
    rotator.start();
  });

  client.on(Events.Error, (error) => {
    logger.error('Discord client error.', {
      error: describeError(error),
    });
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    void handleChatCommand(appContext, registry, interaction).catch((error) => {
      logger.error('Unhandled interaction pipeline failure.', {
        command: interaction.commandName,
        interactionId: interaction.id,
        error: describeError(error),
      });
    });
  });

  const shutdown = async (signal: string) => {
    logger.info('Shutting down.', { signal });
    rotator.stop();
    database.close();
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection.', {
      error: describeError(reason),
    });
  });

  await loginWithRetry(client, botToken, logger);
}

function assertGuildAccess(appContext: AppContext, interaction: ChatInputCommandInteraction): void {
  const allowedGuildIds = appContext.settings.bot.allowed_guild_ids;
  if (!interaction.guildId || allowedGuildIds.length === 0) {
    return;
  }

  if (!allowedGuildIds.includes(interaction.guildId)) {
    throw new GuildAccessError(interaction.guildId);
  }
}

function assertCommandAccess(
  appContext: AppContext,
  interaction: ChatInputCommandInteraction,
  requiredScope: string,
  guildOnly = false,
): void {
  if (guildOnly && !interaction.inGuild()) {
    throw new GuildOnlyError(interaction.commandName);
  }

  assertGuildAccess(appContext, interaction);
  ensureScope(appContext, interaction, requiredScope);
}

async function handleChatCommand(
  appContext: AppContext,
  registry: CommandRegistry,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const logger = appContext.logger.child({ command: interaction.commandName });
  const requestContext = buildRequestContext(interaction);
  const started = performance.now();

  const command = registry.get(interaction.commandName);
  if (!command) {
    return;
  }

  try {
    assertCommandAccess(appContext, interaction, command.scope, command.guildOnly ?? false);
    await command.execute(appContext, interaction);

    appContext.database.logCommand({
      commandName: requestContext.commandName,
      userId: requestContext.userId,
      username: requestContext.username,
      guildId: requestContext.guildId,
      channelId: requestContext.channelId,
      success: true,
      latencyMs: Math.round(performance.now() - started),
      correlationId: requestContext.correlationId,
    });

    logger.info('Command completed.', {
      userId: requestContext.userId,
      guildId: requestContext.guildId,
      channelId: requestContext.channelId,
      latencyMs: Math.round(performance.now() - started),
      correlationId: requestContext.correlationId,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    appContext.database.logCommand({
      commandName: requestContext.commandName,
      userId: requestContext.userId,
      username: requestContext.username,
      guildId: requestContext.guildId,
      channelId: requestContext.channelId,
      success: false,
      latencyMs: Math.round(performance.now() - started),
      errorCode: normalized.code,
      errorMessage: normalized.message,
      correlationId: requestContext.correlationId,
    });

    logger.error('Command failed.', {
      userId: requestContext.userId,
      guildId: requestContext.guildId,
      channelId: requestContext.channelId,
      latencyMs: Math.round(performance.now() - started),
      correlationId: requestContext.correlationId,
      errorCode: normalized.code,
      errorMessage: normalized.message,
      details: normalized.details,
    });

    await replyWithCommandError(interaction, normalized.userMessage, logger);
  }
}

function normalizeError(error: unknown): {
  code: string;
  message: string;
  userMessage: string;
  details?: Record<string, unknown>;
} {
  if (error instanceof ScopeError) {
    return {
      code: error.code,
      message: error.message,
      userMessage: 'You do not have the required scope for that command.',
      details: error.details,
    };
  }

  if (error instanceof GuildAccessError) {
    return {
      code: error.code,
      message: error.message,
      userMessage: 'This bot is not enabled in this guild.',
      details: error.details,
    };
  }

  if (error instanceof GuildOnlyError) {
    return {
      code: error.code,
      message: error.message,
      userMessage: 'That command can only be used inside a guild.',
      details: error.details,
    };
  }

  if (error instanceof UpstreamServiceError) {
    return {
      code: error.code,
      message: error.message,
      userMessage: 'The upstream SeasonalNet service did not complete that request successfully.',
      details: error.details,
    };
  }

  if (error instanceof BotError) {
    return {
      code: error.code,
      message: error.message,
      userMessage: error.message,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNHANDLED_ERROR',
      message: error.message,
      userMessage: error.message,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: String(error),
    userMessage: 'Something unexpected went wrong.',
  };
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
