import { GuildMember, MessageFlags, SlashCommandBuilder, type User } from 'discord.js';

import type { ChatCommand } from '../../core/types.js';
import type { AppContext } from '../../core/app-context.js';
import { getGuildMember, getInteractionScopes } from '../../core/command-helpers.js';
import { hasScope, resolveScopes } from '../../core/scopes.js';
import { infoEmbed, successEmbed, pingEmbed, healthEmbed } from '../../ui/embeds.js';
import type { CommandAuditRecord, ModerationActionRecord } from '../../storage/database.js';
import { BOT_VERSION } from '../../core/version.js';

function buildHelpSections(scopes: Set<string>): string[] {
  const lines = [
    '**Utility**',
    '`/help`, `/about`, `/ping`, `/version`, `/whoami`',
  ];

  if (hasScope(scopes, 'utility.inspect')) {
    lines.push('', '**Utility · Inspect**', '`/health`, `/scopes`, `/audit`, `/modlog`');
  }

  if (hasScope(scopes, 'moderation.manage')) {
    lines.push('', '**Moderation**', '`/lock`, `/unlock`, `/slowmode`, `/purge`, `/timeout`, `/untimeout`, `/warn`, `/note`, `/history`, `/case`');
  }

  if (hasScope(scopes, 'moderation.member')) {
    lines.push('', '**Moderation · Member actions**', '`/kick`, `/ban`, `/unban`, `/softban`');
  }

  if (hasScope(scopes, 'agents.use')) {
    lines.push('', '**Agents**', '`/ask target:<seasonalnet|homelab> question:<text>`');
  }

  lines.push('', 'Configured scopes are enforced centrally by the bot runtime.');
  return lines;
}

function formatScopeList(scopes: Set<string>): string {
  const values = [...scopes].sort();
  return values.length > 0 ? values.map((scope) => `- \`${scope}\``).join('\n') : '- *(none)*';
}

function summarizeRoles(member: GuildMember | null): string {
  if (!member) {
    return 'Direct message or unresolved guild member.';
  }

  const roleNames = member.roles.cache
    .filter((role) => role.id !== member.guild.id)
    .map((role) => role.name)
    .sort((a, b) => a.localeCompare(b));

  return roleNames.length > 0 ? roleNames.join(', ') : 'No non-@everyone roles';
}

function formatCommandAudit(records: CommandAuditRecord[]): string {
  if (records.length === 0) {
    return 'No command audit records found.';
  }

  return records.map((record) => {
    const status = record.success ? 'ok' : `fail:${record.errorCode ?? 'error'}`;
    return `#${record.id} · /${record.commandName} · ${record.username} · ${status} · ${record.latencyMs}ms · ${record.createdAt}`;
  }).join('\n');
}

function parseActionReason(record: ModerationActionRecord): string {
  if (!record.detailsJson) {
    return 'No reason recorded.';
  }

  try {
    const parsed = JSON.parse(record.detailsJson) as { reason?: unknown };
    return typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason : 'No reason recorded.';
  } catch {
    return 'No reason recorded.';
  }
}

function formatModerationActions(records: ModerationActionRecord[]): string {
  if (records.length === 0) {
    return 'No moderation records found.';
  }

  return records.map((record) => {
    const target = record.targetUsername ?? record.targetUserId ?? 'n/a';
    return `#${record.id} · ${record.actionName} · target:${target} · actor:${record.username} · ${record.createdAt}`;
  }).join('\n');
}

async function resolveOptionalTargetMember(
  interaction: Parameters<ChatCommand['execute']>[1],
): Promise<{ member: GuildMember | null; user: User | null }> {
  const targetUser = interaction.options.getUser('user');
  if (!targetUser || !interaction.guild) {
    return { member: null, user: targetUser ?? null };
  }

  const member = interaction.guild.members.cache.get(targetUser.id)
    ?? await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  return { member, user: targetUser };
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
      flags: 'Ephemeral',
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
      flags: 'Ephemeral',
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
      flags: 'Ephemeral',
    });
  },
};

const whoamiCommand: ChatCommand = {
  name: 'whoami',
  scope: 'utility.use',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('whoami')
    .setDescription('Show your effective SeasonalNet bot scopes in this guild.'),
  async execute(context: AppContext, interaction) {
    const member = getGuildMember(interaction);
    const scopes = getInteractionScopes(context, interaction);

    await interaction.reply({
      embeds: [
        infoEmbed(
          'Who Am I',
          [
            `User: **${interaction.user.tag}** (\`${interaction.user.id}\`)`,
            `Guild: **${interaction.guild?.name ?? 'Unknown'}**`,
            `Roles: ${summarizeRoles(member)}`,
            '',
            '**Effective scopes**',
            formatScopeList(scopes),
          ].join('\n'),
        ),
      ],
      flags: 'Ephemeral',
    });
  },
};

const healthCommand: ChatCommand = {
  name: 'health',
  scope: 'utility.inspect',
  data: new SlashCommandBuilder()
    .setName('health')
    .setDescription('Show bot health information and upstream reachability.'),
  async execute(context: AppContext, interaction) {
    await interaction.deferReply({ flags: 'Ephemeral' });

    let agentStatus: 'ok' | 'error' | 'disabled' = 'disabled';
    if (context.settings.integrations.seasonal_agent.enabled) {
      try {
        agentStatus = await context.seasonalAgent.health();
      } catch {
        agentStatus = 'error';
      }
    }

    await interaction.editReply({
      embeds: [
        healthEmbed({
          gatewayPingMs: interaction.client.ws.ping,
          dbPath: context.settings.database.path,
          agentStatus,
        }),
      ],
    });
  },
};

const scopesCommand: ChatCommand = {
  name: 'scopes',
  scope: 'utility.inspect',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('scopes')
    .setDescription('Show effective bot scopes for yourself or another guild member.')
    .addUserOption((option) =>
      option.setName('user').setDescription('Optional user to inspect.').setRequired(false),
    ),
  async execute(context: AppContext, interaction) {
    const { member, user } = await resolveOptionalTargetMember(interaction);
    const effectiveUser = user ?? interaction.user;
    const effectiveMember = member ?? getGuildMember(interaction);
    const scopes = resolveScopes(context.settings, effectiveMember);

    await interaction.reply({
      embeds: [
        infoEmbed(
          'Scope Inspection',
          [
            `User: **${effectiveUser.tag}** (\`${effectiveUser.id}\`)`,
            `Roles: ${summarizeRoles(effectiveMember)}`,
            '',
            '**Effective scopes**',
            formatScopeList(scopes),
          ].join('\n'),
        ),
      ],
      flags: 'Ephemeral',
    });
  },
};

const auditCommand: ChatCommand = {
  name: 'audit',
  scope: 'utility.inspect',
  data: new SlashCommandBuilder()
    .setName('audit')
    .setDescription('Show recent bot command audit events.')
    .addIntegerOption((option) =>
      option.setName('limit').setDescription('How many audit entries to show.').setMinValue(1).setMaxValue(10).setRequired(false),
    )
    .addUserOption((option) =>
      option.setName('user').setDescription('Optional user to filter by.').setRequired(false),
    ),
  async execute(context: AppContext, interaction) {
    const limit = interaction.options.getInteger('limit') ?? 5;
    const targetUser = interaction.options.getUser('user');
    const records = context.database.getRecentCommandAudit(limit, targetUser?.id);

    await interaction.reply({
      embeds: [
        infoEmbed(
          'Recent Command Audit',
          [
            targetUser ? `Filter: **${targetUser.tag}**` : 'Filter: **all users**',
            '',
            '```text',
            formatCommandAudit(records),
            '```',
          ].join('\n'),
        ),
      ],
      flags: 'Ephemeral',
    });
  },
};

const modlogCommand: ChatCommand = {
  name: 'modlog',
  scope: 'utility.inspect',
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('Show recent moderation action records.')
    .addIntegerOption((option) =>
      option.setName('limit').setDescription('How many moderation entries to show.').setMinValue(1).setMaxValue(10).setRequired(false),
    )
    .addUserOption((option) =>
      option.setName('user').setDescription('Optional target user to filter by.').setRequired(false),
    ),
  async execute(context: AppContext, interaction) {
    const limit = interaction.options.getInteger('limit') ?? 5;
    const targetUser = interaction.options.getUser('user');
    const records = context.database.getRecentModerationActions(limit, targetUser?.id);

    await interaction.reply({
      embeds: [
        infoEmbed(
          'Recent Moderation Log',
          [
            targetUser ? `Filter: **${targetUser.tag}**` : 'Filter: **all targets**',
            '',
            '```text',
            formatModerationActions(records),
            '```',
          ].join('\n'),
        ),
      ],
      flags: 'Ephemeral',
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
      embeds: [successEmbed('Version', `SeasonalNet Discord Bot version **${BOT_VERSION}**`)],
      flags: 'Ephemeral',
    });
  },
};

export const utilityCommands: ChatCommand[] = [
  helpCommand,
  aboutCommand,
  pingCommand,
  whoamiCommand,
  healthCommand,
  scopesCommand,
  auditCommand,
  modlogCommand,
  versionCommand,
];
