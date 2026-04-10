import { EmbedBuilder } from 'discord.js';

import type { ModerationNoticeAction } from '../core/config.js';
import { iconUrl, colorToHex } from './cdn.js';

const Colors = {
  success: 0x57f287,
  error: 0xed4245,
  info: 0x3b82f6,
  agent: 0x8b5cf6,
  warning: 0xfbbf24,
  moderation: 0x5865f2,
  welcome: 0x10b981,
} as const;

const Icons = {
  success: 'circle-check',
  error: 'circle-x',
  info: 'info',
  ping: 'activity',
  health: 'heart-pulse',
  agent: 'bot',
  footer: 'cloud-rain',
  lock: 'lock',
  unlock: 'lock-open',
  slowmode: 'timer-reset',
  purge: 'broom',
  warn: 'shield-alert',
  note: 'notebook-pen',
  history: 'scroll-text',
  case: 'file-search',
  timeout: 'timer',
  untimeout: 'timer-off',
  kick: 'log-out',
  ban: 'shield-ban',
  unban: 'shield-check',
  softban: 'shield-minus',
  welcome: 'party-popper',
  welcomeFooter: 'badge-plus',
} as const;

const FOOTER_ICON_HEX = '8094A4';
const FOOTER_TEXT = 'rain · SeasonalNet';

const MAX_EMBED_DESCRIPTION = 4000;

let _cdnBase = 'https://cdn.seasonalnet.org';

export function configureEmbeds(iconBaseUrl: string): void {
  _cdnBase = iconBaseUrl;
}

interface EmbedStyle {
  color: number;
  icon: string;
}

export type ModerationEmbedKind = ModerationNoticeAction
  | 'lock'
  | 'unlock'
  | 'slowmode'
  | 'purge'
  | 'history'
  | 'case';

const ModerationStyles: Record<ModerationEmbedKind, EmbedStyle> = {
  lock: { color: Colors.moderation, icon: Icons.lock },
  unlock: { color: Colors.success, icon: Icons.unlock },
  slowmode: { color: Colors.warning, icon: Icons.slowmode },
  purge: { color: Colors.warning, icon: Icons.purge },
  warn: { color: Colors.warning, icon: Icons.warn },
  note: { color: Colors.info, icon: Icons.note },
  history: { color: Colors.info, icon: Icons.history },
  case: { color: Colors.info, icon: Icons.case },
  timeout: { color: Colors.warning, icon: Icons.timeout },
  untimeout: { color: Colors.success, icon: Icons.untimeout },
  kick: { color: Colors.warning, icon: Icons.kick },
  ban: { color: Colors.error, icon: Icons.ban },
  unban: { color: Colors.success, icon: Icons.unban },
  softban: { color: Colors.warning, icon: Icons.softban },
};

function truncateDescription(description: string): string {
  return description.length > MAX_EMBED_DESCRIPTION
    ? `${description.slice(0, MAX_EMBED_DESCRIPTION)}\n*(truncated)*`
    : description;
}

function base(): EmbedBuilder {
  return new EmbedBuilder()
    .setFooter({
      text: FOOTER_TEXT,
      iconURL: iconUrl(_cdnBase, Icons.footer, FOOTER_ICON_HEX),
    })
    .setTimestamp(new Date());
}

function styledEmbed(title: string, description: string, style: EmbedStyle): EmbedBuilder {
  return base()
    .setColor(style.color)
    .setTitle(title)
    .setDescription(truncateDescription(description))
    .setThumbnail(iconUrl(_cdnBase, style.icon, colorToHex(style.color)));
}

export function successEmbed(title: string, description: string): EmbedBuilder {
  return styledEmbed(title, description, {
    color: Colors.success,
    icon: Icons.success,
  });
}

export function errorEmbed(title: string, description: string): EmbedBuilder {
  return styledEmbed(title, description, {
    color: Colors.error,
    icon: Icons.error,
  });
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return styledEmbed(title, description, {
    color: Colors.info,
    icon: Icons.info,
  });
}

export function customEmbed(
  title: string,
  description: string,
  options: {
    color?: number;
    icon?: string;
  } = {},
): EmbedBuilder {
  return styledEmbed(title, description, {
    color: options.color ?? Colors.info,
    icon: options.icon ?? Icons.info,
  });
}

export function welcomeEmbed(title: string, description: string, note?: string): EmbedBuilder {
  const embed = styledEmbed(title, description, {
    color: Colors.welcome,
    icon: Icons.welcome,
  });

  if (note?.trim()) {
    embed.addFields({
      name: 'Server Note',
      value: note.trim(),
      inline: false,
    });
    embed.setAuthor({
      name: 'Welcome',
      iconURL: iconUrl(_cdnBase, Icons.welcomeFooter, colorToHex(Colors.welcome)),
    });
  }

  return embed;
}

export function moderationActionEmbed(kind: ModerationEmbedKind, title: string, description: string): EmbedBuilder {
  return styledEmbed(title, description, ModerationStyles[kind]);
}

export function moderationNoticeEmbed(
  action: ModerationNoticeAction,
  title: string,
  description: string,
  note?: string,
): EmbedBuilder {
  const embed = styledEmbed(title, description, ModerationStyles[action]);

  if (note?.trim()) {
    embed.addFields({
      name: 'Additional Information',
      value: note.trim(),
      inline: false,
    });
  }

  return embed;
}

export function pingEmbed(latencyMs: number): EmbedBuilder {
  const color =
    latencyMs < 100 ? Colors.success :
    latencyMs < 300 ? Colors.warning :
                      Colors.error;

  return styledEmbed('Pong', `Gateway heartbeat: **${latencyMs} ms**`, {
    color,
    icon: Icons.ping,
  });
}

export interface HealthStatus {
  gatewayPingMs: number;
  dbPath: string;
  agentStatus: 'ok' | 'error' | 'disabled';
}

export function healthEmbed(status: HealthStatus): EmbedBuilder {
  const agentIcon =
    status.agentStatus === 'ok'       ? '✅' :
    status.agentStatus === 'disabled' ? '⏸' :
                                        '❌';

  const gatewayIcon = status.gatewayPingMs < 300 ? '✅' : '⚠️';
  const overallHealthy = status.agentStatus !== 'error';
  const color = overallHealthy ? Colors.success : Colors.error;

  return base()
    .setColor(color)
    .setTitle('Health')
    .setThumbnail(iconUrl(_cdnBase, Icons.health, colorToHex(color)))
    .addFields(
      { name: 'Bot', value: '✅ ok', inline: true },
      { name: 'Gateway', value: `${gatewayIcon} **${status.gatewayPingMs} ms**`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: 'Seasonal Agent', value: `${agentIcon} **${status.agentStatus}**`, inline: true },
      { name: 'SQLite', value: `\`${status.dbPath}\``, inline: false },
    );
}

export interface AgentReplyData {
  reply: string;
  usedTools: string[];
  model: string;
  toolRounds: number;
}

export function agentReplyEmbed(target: string, data: AgentReplyData): EmbedBuilder {
  const replyText = data.reply || '*(no reply)*';

  const embed = styledEmbed(`Agent · ${target}`, replyText, {
    color: Colors.agent,
    icon: Icons.agent,
  });

  if (data.usedTools.length > 0) {
    embed.addFields({
      name: 'Tools used',
      value: data.usedTools.map((tool) => `\`${tool}\``).join(', '),
      inline: true,
    });
  }

  embed.addFields({ name: 'Model', value: `\`${data.model}\``, inline: true });

  if (data.toolRounds > 0) {
    embed.addFields({ name: 'Tool rounds', value: String(data.toolRounds), inline: true });
  }

  return embed;
}
