import { REST, Routes } from 'discord.js';

import { loadSettings, requireEnv } from '../src/core/config.js';
import { loadCommands } from '../src/modules/index.js';

function getTargetGuildIds(settings: ReturnType<typeof loadSettings>): string[] {
  const guildIds = new Set<string>();
  const guildIdFromEnv = settings.bot.guild_id_env ? process.env[settings.bot.guild_id_env] : undefined;

  if (guildIdFromEnv) {
    guildIds.add(guildIdFromEnv);
  }

  for (const guildId of settings.bot.allowed_guild_ids) {
    guildIds.add(guildId);
  }

  return [...guildIds];
}

async function main(): Promise<void> {
  const settings = loadSettings();
  const token = requireEnv(settings.bot.token_env);
  const clientId = requireEnv(settings.bot.client_id_env);
  const deployGlobal = process.env.SEASONALNET_BOT_DEPLOY_GLOBAL === 'true';

  const commandPayload = loadCommands().map((command) => command.data.toJSON());
  const rest = new REST().setToken(token);
  const guildIds = getTargetGuildIds(settings);

  if (guildIds.length > 0) {
    for (const guildId of guildIds) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commandPayload,
      });
      console.log(`Deployed ${commandPayload.length} commands to guild ${guildId}.`);
    }
    return;
  }

  if (!deployGlobal) {
    throw new Error(
      'Refusing global command deployment without a configured guild target. Set SEASONALNET_BOT_GUILD_ID, bot.allowed_guild_ids, or SEASONALNET_BOT_DEPLOY_GLOBAL=true.',
    );
  }

  await rest.put(Routes.applicationCommands(clientId), {
    body: commandPayload,
  });
  console.log(`Deployed ${commandPayload.length} global commands.`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
