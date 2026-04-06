import { REST, Routes } from 'discord.js';

import { loadSettings, requireEnv } from '../src/core/config.js';
import { loadCommands } from '../src/modules/index.js';

async function main(): Promise<void> {
  const settings = loadSettings();
  const token = requireEnv(settings.bot.token_env);
  const clientId = requireEnv(settings.bot.client_id_env);
  const guildId = settings.bot.guild_id_env ? process.env[settings.bot.guild_id_env] : undefined;

  const commandPayload = loadCommands().map((command) => command.data.toJSON());
  const rest = new REST().setToken(token);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commandPayload,
    });
    console.log(`Deployed ${commandPayload.length} commands to guild ${guildId}.`);
    return;
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
