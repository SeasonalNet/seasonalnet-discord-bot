import process from 'node:process';

import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
    type ChatInputCommandInteraction,
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
import { loadCommands } from './modules/index.js';
import { errorEmbed, configureEmbeds } from './ui/embeds.js';
import { ensureScope } from './core/command-helpers.js';

async function main(): Promise<void> {
  const settings = loadSettings();
  const logger = new Logger(settings.logging.level);

  // Configure embed factories with the CDN base URL before any commands run.
  configureEmbeds(settings.cdn.icon_base_url);

  const botToken = requireEnv(settings.bot.token_env);
  const seasonalAgentToken = requireEnv(settings.integrations.seasonal_agent.bot_token_env);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
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
  for (const command of loadCommands()) {
    registry.register(command);
  }

  client.once(Events.ClientReady, (readyClient) => {
    logger.info('Discord bot ready.', {
      user: readyClient.user.tag,
      guilds: readyClient.guilds.cache.size,
    });

    readyClient.user.setPresence({
      activities: [{ name: settings.bot.activity, type: ActivityType.Playing }],
      status: settings.bot.status,
    });
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    await handleChatCommand(appContext, registry, interaction);
  });

  const shutdown = async (signal: string) => {
    logger.info('Shutting down.', { signal });
    database.close();
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await client.login(botToken);
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

    const replyPayload = {
      embeds: [errorEmbed('Command Failed', normalized.userMessage)],
      flags: ['Ephemeral'] as const,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(replyPayload);
      return;
    }

    await interaction.reply(replyPayload);
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
