import type { GuildMember } from 'discord.js';

import type { WelcomeGuildSettings } from '../../core/config.js';

export interface WelcomeTemplateData {
  user_mention: string;
  user_tag: string;
  user_id: string;
  guild_name: string;
  member_count: string;
}

export interface ResolvedWelcomeMessage {
  title: string;
  body: string;
  footer?: string;
}

export function buildWelcomeTemplateData(member: GuildMember): WelcomeTemplateData {
  return {
    user_mention: `<@${member.id}>`,
    user_tag: member.user.tag,
    user_id: member.id,
    guild_name: member.guild.name,
    member_count: String(member.guild.memberCount),
  };
}

export function fillWelcomeTemplate(template: string, data: WelcomeTemplateData): string {
  return template.replace(/\{([a-z_]+)\}/g, (_match, token: string) => data[token as keyof WelcomeTemplateData] ?? `{${token}}`);
}

export function buildWelcomeMessage(settings: WelcomeGuildSettings, member: GuildMember): ResolvedWelcomeMessage {
  const data = buildWelcomeTemplateData(member);
  return {
    title: fillWelcomeTemplate(settings.title, data),
    body: fillWelcomeTemplate(settings.body, data),
    footer: settings.footer.trim() ? fillWelcomeTemplate(settings.footer, data) : undefined,
  };
}
