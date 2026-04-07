import {
  ChannelType,
  Guild,
  GuildMember,
    SlashCommandBuilder,
  TextChannel,
  User,
} from 'discord.js';

import type { ChatCommand } from '../../core/types.js';
import type { AppContext } from '../../core/app-context.js';
import { ensureDiscordPermission, DiscordPermissions } from '../../core/command-helpers.js';
import { moderationActionEmbed } from '../../ui/embeds.js';
import { sendModerationNotice } from './notices.js';
import type { ModerationActionRecord } from '../../storage/database.js';
import type { ModerationNoticeAction } from '../../core/config.js';

function requireGuildTextChannel(interaction: Parameters<ChatCommand['execute']>[1]): TextChannel {
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error('This command only works in a standard guild text channel.');
  }
  return channel as TextChannel;
}

function requireGuild(interaction: Parameters<ChatCommand['execute']>[1]): Guild {
  if (!interaction.guild) {
    throw new Error('This command requires a guild context.');
  }
  return interaction.guild;
}

function parseActionDetails(record: ModerationActionRecord): Record<string, unknown> {
  if (!record.detailsJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(record.detailsJson) as Record<string, unknown>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function formatDetailsValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'n/a';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function buildCaseDetails(record: ModerationActionRecord): string {
  const details = parseActionDetails(record);
  const extraLines = Object.entries(details).map(([key, value]) => `${key}: ${formatDetailsValue(value)}`);

  return [
    `Case: **#${record.id}**`,
    `Action: **${record.actionName}**`,
    `Actor: **${record.username}** (\`${record.userId}\`)`,
    `Target: **${record.targetUsername ?? 'n/a'}**${record.targetUserId ? ` (\`${record.targetUserId}\`)` : ''}`,
    `Created: **${record.createdAt}**`,
    ...(extraLines.length > 0 ? ['', '**Details**', ...extraLines] : []),
  ].join('\n');
}

function buildHistoryLines(records: ModerationActionRecord[]): string {
  if (records.length === 0) {
    return 'No moderation history found for that user.';
  }

  return records.map((record) => {
    const details = parseActionDetails(record);
    const reason = typeof details.reason === 'string' && details.reason.trim() ? details.reason : 'No reason recorded.';
    return `#${record.id} · ${record.actionName} · ${record.createdAt} · ${reason}`;
  }).join('\n');
}

async function resolveGuildMember(guild: Guild, userId: string): Promise<GuildMember | null> {
  return guild.members.cache.get(userId)
    ?? await guild.members.fetch(userId).catch(() => null);
}

function ensureNotSelfOrBot(interaction: Parameters<ChatCommand['execute']>[1], targetUser: User): void {
  if (targetUser.id === interaction.user.id) {
    throw new Error('You cannot target yourself with that command.');
  }

  if (targetUser.bot) {
    throw new Error('That command cannot target a bot account.');
  }
}

function assertManageableMember(member: GuildMember, action: 'timeout' | 'kick' | 'ban'): void {
  if (action === 'timeout' && !member.moderatable) {
    throw new Error('That member cannot be timed out by this bot.');
  }

  if (action === 'kick' && !member.kickable) {
    throw new Error('That member cannot be kicked by this bot.');
  }

  if (action === 'ban' && !member.bannable) {
    throw new Error('That member cannot be banned by this bot.');
  }
}

async function recordModerationAction(
  context: AppContext,
  interaction: Parameters<ChatCommand['execute']>[1],
  actionName: string,
  targetUser: User | null,
  details: Record<string, unknown>,
  noticeAction?: ModerationNoticeAction,
): Promise<{ caseId: number; notice: Awaited<ReturnType<typeof sendModerationNotice>> | null }> {
  const caseId = context.database.logModerationAction({
    actionName,
    userId: interaction.user.id,
    username: interaction.user.tag,
    guildId: interaction.guildId ?? undefined,
    channelId: interaction.channelId ?? undefined,
    targetUserId: targetUser?.id,
    targetUsername: targetUser?.tag,
    detailsJson: JSON.stringify(details),
  });

  let notice: Awaited<ReturnType<typeof sendModerationNotice>> | null = null;
  if (targetUser && noticeAction && interaction.guild) {
    notice = await sendModerationNotice(context.settings, targetUser, {
      action: noticeAction,
      actionLabel: actionName,
      guildName: interaction.guild.name,
      moderatorTag: interaction.user.tag,
      moderatorId: interaction.user.id,
      targetTag: targetUser.tag,
      targetId: targetUser.id,
      caseId,
      reason: typeof details.reason === 'string' ? details.reason : undefined,
      durationMinutes: typeof details.minutes === 'number' ? details.minutes : undefined,
    });

    context.database.updateModerationActionDetails(caseId, JSON.stringify({
      ...details,
      dm_notice: notice,
    }));
  }

  return { caseId, notice };
}

function describeNoticeResult(notice: Awaited<ReturnType<typeof sendModerationNotice>> | null): string {
  if (!notice || !notice.attempted) {
    return 'DM notice: **not attempted**';
  }

  if (notice.delivered) {
    return 'DM notice: **delivered**';
  }

  return `DM notice: **failed** (${notice.error ?? 'unknown error'})`;
}

const lockCommand: ChatCommand = {
  name: 'lock',
  scope: 'moderation.lock',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock the current channel for @everyone.')
    .addStringOption((option) =>
      option.setName('reason').setDescription('Optional reason shown in audit logs.').setRequired(false),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.ManageChannels, 'You need Manage Channels to use /lock.');

    const channel = requireGuildTextChannel(interaction);
    const everyoneRole = interaction.guild?.roles.everyone;
    if (!everyoneRole) {
      throw new Error('Could not resolve the @everyone role for this guild.');
    }

    const reason = interaction.options.getString('reason') ?? context.settings.moderation.lock_reason;
    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false }, { reason });
    await recordModerationAction(context, interaction, 'lock', null, { reason });

    await interaction.reply({
      embeds: [moderationActionEmbed('lock', 'Channel Locked', `Locked ${channel}.\nReason: **${reason}**`)],
    });
  },
};

const unlockCommand: ChatCommand = {
  name: 'unlock',
  scope: 'moderation.lock',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock the current channel for @everyone.')
    .addStringOption((option) =>
      option.setName('reason').setDescription('Optional reason shown in audit logs.').setRequired(false),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.ManageChannels, 'You need Manage Channels to use /unlock.');

    const channel = requireGuildTextChannel(interaction);
    const everyoneRole = interaction.guild?.roles.everyone;
    if (!everyoneRole) {
      throw new Error('Could not resolve the @everyone role for this guild.');
    }

    const reason = interaction.options.getString('reason') ?? context.settings.moderation.unlock_reason;
    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null }, { reason });
    await recordModerationAction(context, interaction, 'unlock', null, { reason });

    await interaction.reply({
      embeds: [moderationActionEmbed('unlock', 'Channel Unlocked', `Unlocked ${channel}.\nReason: **${reason}**`)],
    });
  },
};

const slowmodeCommand: ChatCommand = {
  name: 'slowmode',
  scope: 'moderation.slowmode',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode on the current channel.')
    .addIntegerOption((option) =>
      option
        .setName('seconds')
        .setDescription('Slowmode delay in seconds (0 to disable).')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.ManageChannels, 'You need Manage Channels to use /slowmode.');

    const channel = requireGuildTextChannel(interaction);
    const seconds = interaction.options.getInteger('seconds', true);
    await channel.setRateLimitPerUser(seconds, `Changed by ${interaction.user.tag}`);
    await recordModerationAction(context, interaction, 'slowmode', null, { seconds });

    const summary = seconds === 0 ? 'Slowmode disabled.' : `Slowmode set to **${seconds} seconds**.`;
    await interaction.reply({
      embeds: [moderationActionEmbed('slowmode', 'Slowmode Updated', summary)],
    });
  },
};

const purgeCommand: ChatCommand = {
  name: 'purge',
  scope: 'moderation.purge',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete recent messages from the current channel.')
    .addIntegerOption((option) =>
      option
        .setName('count')
        .setDescription('How many recent messages to remove.')
        .setMinValue(1)
        .setRequired(true),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.ManageMessages, 'You need Manage Messages to use /purge.');

    const channel = requireGuildTextChannel(interaction);
    const count = interaction.options.getInteger('count', true);

    if (count > context.settings.moderation.max_purge_count) {
      throw new Error(`Purge count exceeds configured maximum of ${context.settings.moderation.max_purge_count}.`);
    }

    const deleted = await channel.bulkDelete(count, true);
    await recordModerationAction(context, interaction, 'purge', null, { requested: count, deleted: deleted.size });

    await interaction.reply({
      embeds: [moderationActionEmbed('purge', 'Messages Purged', `Deleted **${deleted.size}** recent messages.`)],
      flags: 'Ephemeral',
    });
  },
};

const warnCommand: ChatCommand = {
  name: 'warn',
  scope: 'moderation.manage',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Record a warning for a guild user and send a DM notice when possible.')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to warn.').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the warning.').setRequired(true),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.ManageMessages, 'You need Manage Messages to use /warn.');

    const targetUser = interaction.options.getUser('user', true);
    ensureNotSelfOrBot(interaction, targetUser);

    const reason = interaction.options.getString('reason', true);
    const result = await recordModerationAction(context, interaction, 'warn', targetUser, { reason }, 'warn');

    await interaction.reply({
      embeds: [
        moderationActionEmbed(
          'warn',
          'Warning Recorded',
          `${targetUser} was warned.\nCase: **#${result.caseId}**\nReason: **${reason}**\n${describeNoticeResult(result.notice)}`,
        ),
      ],
      flags: 'Ephemeral',
    });
  },
};

const noteCommand: ChatCommand = {
  name: 'note',
  scope: 'moderation.manage',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Record a moderator note for a guild user and send a DM notice when possible.')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to note.').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Note text.').setRequired(true),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.ManageMessages, 'You need Manage Messages to use /note.');

    const targetUser = interaction.options.getUser('user', true);
    ensureNotSelfOrBot(interaction, targetUser);

    const reason = interaction.options.getString('reason', true);
    const result = await recordModerationAction(context, interaction, 'note', targetUser, { reason }, 'note');

    await interaction.reply({
      embeds: [
        moderationActionEmbed(
          'note',
          'Moderator Note Recorded',
          `${targetUser} now has a moderator note.\nCase: **#${result.caseId}**\nNote: **${reason}**\n${describeNoticeResult(result.notice)}`,
        ),
      ],
      flags: 'Ephemeral',
    });
  },
};

const historyCommand: ChatCommand = {
  name: 'history',
  scope: 'moderation.manage',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Show recent moderation history for a user.')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to inspect.').setRequired(true),
    )
    .addIntegerOption((option) =>
      option.setName('limit').setDescription('How many records to show.').setMinValue(1).setMaxValue(10).setRequired(false),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.ManageMessages, 'You need Manage Messages to use /history.');

    const targetUser = interaction.options.getUser('user', true);
    const limit = interaction.options.getInteger('limit') ?? 5;
    const records = context.database.getRecentModerationActions(limit, targetUser.id);

    await interaction.reply({
      embeds: [
        moderationActionEmbed(
          'history',
          `Moderation History · ${targetUser.tag}`,
          ['```text', buildHistoryLines(records), '```'].join('\n'),
        ),
      ],
      flags: 'Ephemeral',
    });
  },
};

const caseCommand: ChatCommand = {
  name: 'case',
  scope: 'moderation.manage',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('Show details for one moderation case by numeric ID.')
    .addIntegerOption((option) =>
      option.setName('case_id').setDescription('The moderation case ID.').setMinValue(1).setRequired(true),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.ManageMessages, 'You need Manage Messages to use /case.');

    const caseId = interaction.options.getInteger('case_id', true);
    const record = context.database.getModerationActionById(caseId);
    if (!record) {
      throw new Error(`No moderation case exists with ID ${caseId}.`);
    }

    await interaction.reply({
      embeds: [moderationActionEmbed('case', `Moderation Case #${caseId}`, buildCaseDetails(record))],
      flags: 'Ephemeral',
    });
  },
};

const timeoutCommand: ChatCommand = {
  name: 'timeout',
  scope: 'moderation.timeout',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Temporarily timeout a guild member.')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to timeout.').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('minutes')
        .setDescription('Timeout length in minutes.')
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the timeout.').setRequired(false),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.ModerateMembers, 'You need Moderate Members to use /timeout.');

    const guild = requireGuild(interaction);
    const targetUser = interaction.options.getUser('user', true);
    ensureNotSelfOrBot(interaction, targetUser);

    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason') ?? 'Timed out by SeasonalNet bot';

    const member = await resolveGuildMember(guild, targetUser.id);
    if (!member) {
      throw new Error('That user is not available in this guild.');
    }

    assertManageableMember(member, 'timeout');
    await member.timeout(minutes * 60_000, reason);
    const result = await recordModerationAction(context, interaction, 'timeout', targetUser, { minutes, reason }, 'timeout');

    await interaction.reply({
      embeds: [
        moderationActionEmbed(
          'timeout',
          'Member Timed Out',
          `${targetUser} has been timed out for **${minutes} minutes**.\nCase: **#${result.caseId}**\nReason: **${reason}**\n${describeNoticeResult(result.notice)}`,
        ),
      ],
      flags: 'Ephemeral',
    });
  },
};

const untimeoutCommand: ChatCommand = {
  name: 'untimeout',
  scope: 'moderation.timeout',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Clear an active timeout for a guild member.')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to untimeout.').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for clearing the timeout.').setRequired(false),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.ModerateMembers, 'You need Moderate Members to use /untimeout.');

    const guild = requireGuild(interaction);
    const targetUser = interaction.options.getUser('user', true);
    ensureNotSelfOrBot(interaction, targetUser);

    const reason = interaction.options.getString('reason') ?? 'Timeout cleared by SeasonalNet bot';
    const member = await resolveGuildMember(guild, targetUser.id);
    if (!member) {
      throw new Error('That user is not available in this guild.');
    }

    assertManageableMember(member, 'timeout');
    await member.timeout(null, reason);
    const result = await recordModerationAction(context, interaction, 'untimeout', targetUser, { reason }, 'untimeout');

    await interaction.reply({
      embeds: [
        moderationActionEmbed(
          'untimeout',
          'Timeout Cleared',
          `${targetUser}'s timeout was cleared.\nCase: **#${result.caseId}**\nReason: **${reason}**\n${describeNoticeResult(result.notice)}`,
        ),
      ],
      flags: 'Ephemeral',
    });
  },
};

const kickCommand: ChatCommand = {
  name: 'kick',
  scope: 'moderation.member',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a guild member.')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to kick.').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the kick.').setRequired(false),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.KickMembers, 'You need Kick Members to use /kick.');

    const guild = requireGuild(interaction);
    const targetUser = interaction.options.getUser('user', true);
    ensureNotSelfOrBot(interaction, targetUser);

    const reason = interaction.options.getString('reason') ?? 'Removed by SeasonalNet bot';
    const member = await resolveGuildMember(guild, targetUser.id);
    if (!member) {
      throw new Error('That user is not available in this guild.');
    }

    assertManageableMember(member, 'kick');
    await member.kick(reason);
    const result = await recordModerationAction(context, interaction, 'kick', targetUser, { reason }, 'kick');

    await interaction.reply({
      embeds: [
        moderationActionEmbed(
          'kick',
          'Member Kicked',
          `${targetUser.tag} was kicked.\nCase: **#${result.caseId}**\nReason: **${reason}**\n${describeNoticeResult(result.notice)}`,
        ),
      ],
      flags: 'Ephemeral',
    });
  },
};

const banCommand: ChatCommand = {
  name: 'ban',
  scope: 'moderation.member',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the guild.')
    .addUserOption((option) =>
      option.setName('user').setDescription('The user to ban.').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('delete_days')
        .setDescription('How many days of message history to delete (0-7).')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the ban.').setRequired(false),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.BanMembers, 'You need Ban Members to use /ban.');

    const guild = requireGuild(interaction);
    const targetUser = interaction.options.getUser('user', true);
    ensureNotSelfOrBot(interaction, targetUser);

    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
    const reason = interaction.options.getString('reason') ?? 'Banned by SeasonalNet bot';

    const member = await resolveGuildMember(guild, targetUser.id);
    if (member) {
      assertManageableMember(member, 'ban');
    }

    await guild.bans.create(targetUser.id, {
      reason,
      deleteMessageSeconds: deleteDays * 86_400,
    });
    const result = await recordModerationAction(context, interaction, 'ban', targetUser, { reason, delete_days: deleteDays }, 'ban');

    await interaction.reply({
      embeds: [
        moderationActionEmbed(
          'ban',
          'User Banned',
          `${targetUser.tag} was banned.\nCase: **#${result.caseId}**\nReason: **${reason}**\nDelete message days: **${deleteDays}**\n${describeNoticeResult(result.notice)}`,
        ),
      ],
      flags: 'Ephemeral',
    });
  },
};

const unbanCommand: ChatCommand = {
  name: 'unban',
  scope: 'moderation.member',
  guildOnly: true,
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by numeric Discord user ID.')
    .addStringOption((option) =>
      option.setName('user_id').setDescription('The user ID to unban.').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for the unban.').setRequired(false),
    ),
  async execute(context, interaction) {
    ensureDiscordPermission(interaction, DiscordPermissions.BanMembers, 'You need Ban Members to use /unban.');

    const guild = requireGuild(interaction);
    const userId = interaction.options.getString('user_id', true).trim();
    if (!/^\d{17,20}$/.test(userId)) {
      throw new Error('Provide a valid numeric Discord user ID.');
    }

    const reason = interaction.options.getString('reason') ?? 'Ban lifted by SeasonalNet bot';
    const targetUser = await interaction.client.users.fetch(userId).catch(() => null);
    await guild.bans.remove(userId, reason);
    const result = await recordModerationAction(context, interaction, 'unban', targetUser, { reason, user_id: userId }, targetUser ? 'unban' : undefined);

    await interaction.reply({
      embeds: [
        moderationActionEmbed(
          'unban',
          'User Unbanned',
          `User ID \`${userId}\` was unbanned.\nCase: **#${result.caseId}**\nReason: **${reason}**\n${describeNoticeResult(result.notice)}`,
        ),
      ],
      flags: 'Ephemeral',
    });
  },
};

export const moderationCommands: ChatCommand[] = [
  lockCommand,
  unlockCommand,
  slowmodeCommand,
  purgeCommand,
  warnCommand,
  noteCommand,
  historyCommand,
  caseCommand,
  timeoutCommand,
  untimeoutCommand,
  kickCommand,
  banCommand,
  unbanCommand,
];
