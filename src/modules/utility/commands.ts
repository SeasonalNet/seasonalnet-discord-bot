import { SlashCommandBuilder } from 'discord.js';

import type { ChatCommand } from '../../core/types.js';
import type { AppContext } from '../../core/app-context.js';
import { ensureScope } from '../../core/command-helpers.js';
import { infoEmbed, successEmbed, pingEmbed, healthEmbed } from '../../ui/embeds.js';

const helpCommand: ChatCommand = {
  name: 'help',
  scope: 'utility.use',
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available SeasonalNet bot workflows.'),
  async execute(context: AppContext, interaction) {
    ensureScope(context, interaction, 'utility.use');

    const lines = [
      '**Utility**',
      '`/help`, `/about`, `/ping`, `/health`, `/version`',
      '',
      '**Moderation**',
      '`/lock`, `/unlock`, `/slowmode`, `/purge`, `/timeout`',
      '',
      '**Agents**',
      '`/ask target:<seasonalnet|homelab> question:<text>`',
    ];

    await interaction.reply({
      embeds: [infoEmbed('SeasonalNet Bot Help', lines.join('\n'))],
    });
  },
};

const aboutCommand: ChatCommand = {
  name: 'about',
  scope: 'utility.use',
  data: new SlashCommandBuilder()
    .setName('about')
    .setDescription('Show what this shared bot is for.'),
  async execute(context: AppContext, interaction) {
    ensureScope(context, interaction, 'utility.use');

    await interaction.reply({
      embeds: [
        infoEmbed(
          'About SeasonalNet Bot',
          'Shared SeasonalNet workflow bot for utility, moderation, and agent-assisted operations. Real business logic should stay in backend services, not inside Discord command handlers.',
        ),
      ],
    });
  },
};

const pingCommand: ChatCommand = {
  name: 'ping',
  scope: 'utility.use',
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check Discord round-trip latency for the bot.'),
  async execute(context: AppContext, interaction) {
    ensureScope(context, interaction, 'utility.use');

    const heartbeat = Math.round(context.client.ws.ping);
    await interaction.reply({
      embeds: [pingEmbed(heartbeat)],
    });
  },
};

const healthCommand: ChatCommand = {
  name: 'health',
  scope: 'utility.use',
  data: new SlashCommandBuilder()
    .setName('health')
    .setDescription('Check the bot and seasonal-agent integration status.'),
  async execute(context: AppContext, interaction) {
    ensureScope(context, interaction, 'utility.use');

    await interaction.deferReply();

    const agentHealth = context.settings.integrations.seasonal_agent.enabled
      ? await context.seasonalAgent.health()
      : 'disabled';

    await interaction.editReply({
      embeds: [
        healthEmbed({
          gatewayPingMs: Math.round(context.client.ws.ping),
          dbPath: context.database.path,
          agentStatus: agentHealth,
        }),
      ],
    });
  },
};

const versionCommand: ChatCommand = {
  name: 'version',
  scope: 'utility.use',
  data: new SlashCommandBuilder()
    .setName('version')
    .setDescription('Show the current bot starter version.'),
  async execute(context: AppContext, interaction) {
    ensureScope(context, interaction, 'utility.use');

    await interaction.reply({
      embeds: [infoEmbed('Version', 'seasonalnet-discord-bot starter **v0.1.0**')],
    });
  },
};

export const utilityCommands: ChatCommand[] = [
  helpCommand,
  aboutCommand,
  pingCommand,
  healthCommand,
  versionCommand,
];
