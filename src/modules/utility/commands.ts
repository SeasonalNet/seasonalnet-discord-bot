import { SlashCommandBuilder } from 'discord.js';

import type { ChatCommand } from '../../core/types.js';
import type { AppContext } from '../../core/app-context.js';
import { getInteractionScopes } from '../../core/command-helpers.js';
import { hasScope } from '../../core/scopes.js';
import { infoEmbed, successEmbed, pingEmbed, healthEmbed } from '../../ui/embeds.js';

function buildHelpSections(scopes: Set<string>): string[] {
  const lines = [
    '**Utility**',
    '`/help`, `/about`, `/ping`, `/health`, `/version`',
  ];

  if (hasScope(scopes, 'moderation.lock')) {
    lines.push('', '**Moderation**', '`/lock`, `/unlock`, `/slowmode`, `/purge`, `/timeout`');
  }

  if (hasScope(scopes, 'agents.use')) {
    lines.push('', '**Agents**', '`/ask target:<seasonalnet|homelab> question:<text>`');
  }

  lines.push('', 'Configured scopes are enforced centrally by the bot runtime.');
  return lines;
}

const helpCommand: ChatCommand = {
  name: 'help',
  scope: 'utility.use',
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available SeasonalNet bot workflows.'),
  async execute(context: AppContext, interaction) {
    const scopes = getInteractionScopes(context, interaction);

    await interaction.reply({
      embeds: [infoEmbed('SeasonalNet Bot Help', buildHelpSections(scopes).join('\n'))],
      ephemeral: true,
    });
  },
};

const aboutCommand: ChatCommand = {
  name: 'about',
  scope: 'utility.use',
  data: new SlashCommandBuilder()
    .setName('about')
    .setDescription('Show what this shared bot is for.'),
  async execute(_context: AppContext, interaction) {
    await interaction.reply({
      embeds: [
        infoEmbed(
          'About SeasonalNet Bot',
          'Shared SeasonalNet workflow bot for utility, moderation, and agent-assisted operations. Real business logic should stay in backend services, not inside Discord command handlers.',
        ),
      ],
      ephemeral: true,
    });
  },
};

const pingCommand: ChatCommand = {
  name: 'ping',
  scope: 'utility.use',
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check Discord round-trip latency for the bot.'),
  async execute(_context: AppContext, interaction) {
    const gatewayLatency = interaction.client.ws.ping;
    await interaction.reply({
      embeds: [pingEmbed(gatewayLatency)],
      ephemeral: true,
    });
  },
};

const healthCommand: ChatCommand = {
  name: 'health',
  scope: 'utility.use',
  data: new SlashCommandBuilder()
    .setName('health')
    .setDescription('Show basic bot health information.'),
  async execute(context: AppContext, interaction) {
    await interaction.reply({
      embeds: [
        healthEmbed({
          gatewayPingMs: interaction.client.ws.ping,
          dbPath: context.settings.database.path,
          agentStatus: context.settings.integrations.seasonal_agent.enabled ? 'ok' : 'disabled',
        }),
      ],
      ephemeral: true,
    });
  },
};

const versionCommand: ChatCommand = {
  name: 'version',
  scope: 'utility.use',
  data: new SlashCommandBuilder()
    .setName('version')
    .setDescription('Show the current bot version.'),
  async execute(_context: AppContext, interaction) {
    await interaction.reply({
      embeds: [successEmbed('Version', 'SeasonalNet Discord Bot starter version **0.1.0**')],
      ephemeral: true,
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
