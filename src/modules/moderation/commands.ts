import {
  ChannelType,
  TextChannel,
  SlashCommandBuilder,
  User,
} from 'discord.js';

import type { ChatCommand } from '../../core/types.js';
import type { AppContext } from '../../core/app-context.js';
import { ensureDiscordPermission, ensureScope, DiscordPermissions } from '../../core/command-helpers.js';
import { successEmbed } from '../../ui/embeds.js';

function requireGuildTextChannel(interaction: Parameters<ChatCommand['execute']>[1]): TextChannel {
  const channel = interaction.channel;
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error('This command only works in a standard guild text channel.');
  }
  return channel as TextChannel;
}

async function logModeration(
  context: AppContext,
  interaction: Parameters<ChatCommand['execute']>[1],
  actionName: string,
  targetUser?: User,
  details?: Record<string, unknown>,
): Promise<void> {
  context.database.logModerationAction({
    actionName,
    userId: interaction.user.id,
    username: interaction.user.tag,
    guildId: interaction.guildId ?? undefined,
    channelId: interaction.channelId ?? undefined,
    targetUserId: targetUser?.id,
    targetUsername: targetUser?.tag,
    detailsJson: details ? JSON.stringify(details) : undefined,
  });
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
    ensureScope(context, interaction, 'moderation.lock');
    ensureDiscordPermission(interaction, DiscordPermissions.ManageChannels, 'You need Manage Channels to use /lock.');

    const channel = requireGuildTextChannel(interaction);
    const everyoneRole = interaction.guild?.roles.everyone;
    if (!everyoneRole) {
      throw new Error('Could not resolve the @everyone role for this guild.');
    }

    const reason = interaction.options.getString('reason') ?? context.settings.moderation.lock_reason;
    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false }, { reason });
    await logModeration(context, interaction, 'lock', undefined, { reason });

    await interaction.reply({
      embeds: [successEmbed('Channel Locked', `Locked ${channel}.\nReason: **${reason}**`)],
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
    ensureScope(context, interaction, 'moderation.lock');
    ensureDiscordPermission(interaction, DiscordPermissions.ManageChannels, 'You need Manage Channels to use /unlock.');

    const channel = requireGuildTextChannel(interaction);
    const everyoneRole = interaction.guild?.roles.everyone;
    if (!everyoneRole) {
      throw new Error('Could not resolve the @everyone role for this guild.');
    }

    const reason = interaction.options.getString('reason') ?? context.settings.moderation.unlock_reason;
    await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null }, { reason });
    await logModeration(context, interaction, 'unlock', undefined, { reason });

    await interaction.reply({
      embeds: [successEmbed('Channel Unlocked', `Unlocked ${channel}.\nReason: **${reason}**`)],
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
    ensureScope(context, interaction, 'moderation.slowmode');
    ensureDiscordPermission(interaction, DiscordPermissions.ManageChannels, 'You need Manage Channels to use /slowmode.');

    const channel = requireGuildTextChannel(interaction);
    const seconds = interaction.options.getInteger('seconds', true);
    await channel.setRateLimitPerUser(seconds, `Changed by ${interaction.user.tag}`);
    await logModeration(context, interaction, 'slowmode', undefined, { seconds });

    const summary = seconds === 0 ? 'Slowmode disabled.' : `Slowmode set to **${seconds} seconds**.`;
    await interaction.reply({
      embeds: [successEmbed('Slowmode Updated', summary)],
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
    ensureScope(context, interaction, 'moderation.purge');
    ensureDiscordPermission(interaction, DiscordPermissions.ManageMessages, 'You need Manage Messages to use /purge.');

    const channel = requireGuildTextChannel(interaction);
    const count = interaction.options.getInteger('count', true);

    if (count > context.settings.moderation.max_purge_count) {
      throw new Error(`Purge count exceeds configured maximum of ${context.settings.moderation.max_purge_count}.`);
    }

    const deleted = await channel.bulkDelete(count, true);
    await logModeration(context, interaction, 'purge', undefined, { requested: count, deleted: deleted.size });

    await interaction.reply({
      embeds: [successEmbed('Messages Purged', `Deleted **${deleted.size}** recent messages.`)],
      ephemeral: true,
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
    ensureScope(context, interaction, 'moderation.timeout');
    ensureDiscordPermission(interaction, DiscordPermissions.ModerateMembers, 'You need Moderate Members to use /timeout.');

    const targetUser = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason') ?? 'Timed out by SeasonalNet bot';

    const member = interaction.guild?.members.cache.get(targetUser.id) ?? await interaction.guild?.members.fetch(targetUser.id);
    if (!member) {
      throw new Error('That user is not available in this guild.');
    }

    await member.timeout(minutes * 60_000, reason);
    await logModeration(context, interaction, 'timeout', targetUser, { minutes, reason });

    await interaction.reply({
      embeds: [successEmbed('Member Timed Out', `${targetUser} has been timed out for **${minutes} minutes**.`)],
    });
  },
};

export const moderationCommands: ChatCommand[] = [
  lockCommand,
  unlockCommand,
  slowmodeCommand,
  purgeCommand,
  timeoutCommand,
];
