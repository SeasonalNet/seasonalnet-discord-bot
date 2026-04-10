import { Events, type GuildMember } from 'discord.js';

import type { BotModule } from '../../core/types.js';
import type { AppContext } from '../../core/app-context.js';
import type { WelcomeGuildSettings } from '../../core/config.js';
import { welcomeEmbed } from '../../ui/embeds.js';
import { buildWelcomeMessage } from './service.js';

function resolveWelcomeGuildSettings(context: AppContext, member: GuildMember): WelcomeGuildSettings | null {
  const welcome = context.settings.welcome;
  if (!welcome.enabled) {
    return null;
  }

  const guildSettings = welcome.guilds[member.guild.id];
  if (!guildSettings?.enabled) {
    return null;
  }

  return guildSettings;
}

async function resolveWelcomeChannel(
  context: AppContext,
  member: GuildMember,
  settings: WelcomeGuildSettings,
) {
  if (settings.mode === 'dm') {
    return null;
  }

  if (!settings.channel_id?.trim()) {
    context.logger.warn('Welcome module skipped channel delivery because no channel_id is configured.', {
      guildId: member.guild.id,
      module: 'welcome',
    });
    return null;
  }

  const channel = await member.guild.channels.fetch(settings.channel_id).catch(() => null);
  if (!channel || !channel.isSendable()) {
    context.logger.warn('Welcome module could not resolve a sendable welcome channel.', {
      guildId: member.guild.id,
      channelId: settings.channel_id,
      module: 'welcome',
    });
    return null;
  }

  return channel;
}

async function sendWelcomeChannelMessage(
  context: AppContext,
  member: GuildMember,
  settings: WelcomeGuildSettings,
): Promise<void> {
  const channel = await resolveWelcomeChannel(context, member, settings);
  if (!channel) {
    return;
  }

  const content = buildWelcomeMessage(settings, member);
  const shouldPingInContent = settings.mention_user
    && !settings.title.includes('{user_mention}')
    && !settings.body.includes('{user_mention}')
    && !settings.footer.includes('{user_mention}');

  const sent = await channel.send({
    content: shouldPingInContent ? `${member}` : undefined,
    embeds: [welcomeEmbed(content.title, content.body, content.footer)],
    allowedMentions: shouldPingInContent ? { users: [member.id] } : undefined,
  });

  context.logger.info('Welcome channel message delivered.', {
    guildId: member.guild.id,
    channelId: channel.id,
    userId: member.id,
    module: 'welcome',
  });

  if (settings.delete_after_seconds > 0) {
    setTimeout(() => {
      void sent.delete().catch(() => undefined);
    }, settings.delete_after_seconds * 1000);
  }
}

async function sendWelcomeDm(context: AppContext, member: GuildMember, settings: WelcomeGuildSettings): Promise<void> {
  const content = buildWelcomeMessage(settings, member);

  await member.send({
    embeds: [welcomeEmbed(content.title, content.body, content.footer)],
  });

  context.logger.info('Welcome DM delivered.', {
    guildId: member.guild.id,
    userId: member.id,
    module: 'welcome',
  });
}

async function handleGuildMemberAdd(context: AppContext, member: GuildMember): Promise<void> {
  const settings = resolveWelcomeGuildSettings(context, member);
  if (!settings) {
    return;
  }

  try {
    if (settings.mode === 'channel' || settings.mode === 'channel_and_dm') {
      await sendWelcomeChannelMessage(context, member, settings);
    }

    if (settings.mode === 'dm' || settings.mode === 'channel_and_dm') {
      await sendWelcomeDm(context, member, settings);
    }

    context.logger.info('Welcome flow completed.', {
      guildId: member.guild.id,
      userId: member.id,
      mode: settings.mode,
      module: 'welcome',
    });
  } catch (error) {
    context.logger.warn('Welcome flow failed.', {
      guildId: member.guild.id,
      userId: member.id,
      mode: settings.mode,
      module: 'welcome',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const welcomeModule: BotModule = {
  name: 'welcome',
  register(context) {
    context.client.on(Events.GuildMemberAdd, (member) => {
      void handleGuildMemberAdd(context, member);
    });
  },
};
