import { EmbedBuilder } from 'discord.js';

import { iconUrl, colorToHex } from './cdn.js';

// ── Palette ────────────────────────────────────────────────────────────────

const Colors = {
  success: 0x57f287,  // Discord green
  error:   0xed4245,  // Discord red
  info:    0x3b82f6,  // Blue
  agent:   0x8b5cf6,  // Violet — distinct from generic info
  warning: 0xfbbf24,  // Amber
} as const;

// Lucide icon names paired to each embed type.
const Icons = {
  success: 'circle-check',
  error:   'circle-x',
  info:    'info',
  ping:    'activity',
  health:  'heart-pulse',
  agent:   'bot',
  footer:  'cloud-rain',   // matches "rain · SeasonalNet" footer text
} as const;

// Footer icon color: subdued grey that reads well against Discord backgrounds.
const FOOTER_ICON_HEX = '8094A4';

const FOOTER_TEXT = 'rain · SeasonalNet';

// ── Module-level CDN configuration ─────────────────────────────────────────
//
// Call configureEmbeds() once at startup (from src/index.ts) before any
// embeds are built.  All embed factories below read _cdnBase at call time, so
// they automatically pick up the configured URL.

let _cdnBase = 'https://cdn.seasonalnet.org';

/**
 * Set the CDN base URL used by all embed factories.
 * Should be called once during bot startup with settings.cdn.icon_base_url.
 */
export function configureEmbeds(iconBaseUrl: string): void {
  _cdnBase = iconBaseUrl;
}

// ── Base ───────────────────────────────────────────────────────────────────

function base(): EmbedBuilder {
  return new EmbedBuilder()
    .setFooter({
      text:    FOOTER_TEXT,
      iconURL: iconUrl(_cdnBase, Icons.footer, FOOTER_ICON_HEX),
    })
    .setTimestamp(new Date());
}

// ── Generic status embeds ──────────────────────────────────────────────────

export function successEmbed(title: string, description: string): EmbedBuilder {
  return base()
    .setColor(Colors.success)
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(iconUrl(_cdnBase, Icons.success, colorToHex(Colors.success)));
}

export function errorEmbed(title: string, description: string): EmbedBuilder {
  return base()
    .setColor(Colors.error)
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(iconUrl(_cdnBase, Icons.error, colorToHex(Colors.error)));
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return base()
    .setColor(Colors.info)
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(iconUrl(_cdnBase, Icons.info, colorToHex(Colors.info)));
}

// ── Ping ───────────────────────────────────────────────────────────────────

export function pingEmbed(latencyMs: number): EmbedBuilder {
  const color =
    latencyMs < 100 ? Colors.success :
    latencyMs < 300 ? Colors.warning :
                      Colors.error;

  return base()
    .setColor(color)
    .setTitle('Pong')
    .setDescription(`Gateway heartbeat: **${latencyMs} ms**`)
    .setThumbnail(iconUrl(_cdnBase, Icons.ping, colorToHex(color)));
}

// ── Health ─────────────────────────────────────────────────────────────────

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
      { name: 'Bot',            value: '✅ ok',                                         inline: true  },
      { name: 'Gateway',        value: `${gatewayIcon} **${status.gatewayPingMs} ms**`, inline: true  },
      { name: '\u200b',         value: '\u200b',                                         inline: true  },
      { name: 'Seasonal Agent', value: `${agentIcon} **${status.agentStatus}**`,         inline: true  },
      { name: 'SQLite',         value: `\`${status.dbPath}\``,                           inline: false },
    );
}

// ── Agent reply ────────────────────────────────────────────────────────────

// Accepts the display-relevant parts of BotChatResponse directly so that
// embeds.ts does not need to import from src/integrations/.
export interface AgentReplyData {
  reply: string;
  usedTools: string[];
  model: string;
  toolRounds: number;
}

export function agentReplyEmbed(target: string, data: AgentReplyData): EmbedBuilder {
  // Discord embed description cap is 4096 chars — truncate gracefully.
  const MAX_REPLY = 4000;
  const replyText = data.reply.length > MAX_REPLY
    ? `${data.reply.slice(0, MAX_REPLY)}\n*(truncated)*`
    : (data.reply || '*(no reply)*');

  const embed = base()
    .setColor(Colors.agent)
    .setTitle(`Agent · ${target}`)
    .setDescription(replyText)
    .setThumbnail(iconUrl(_cdnBase, Icons.agent, colorToHex(Colors.agent)));

  if (data.usedTools.length > 0) {
    embed.addFields({
      name: 'Tools used',
      value: data.usedTools.map((t) => `\`${t}\``).join(', '),
      inline: true,
    });
  }

  embed.addFields({ name: 'Model', value: `\`${data.model}\``, inline: true });

  if (data.toolRounds > 0) {
    embed.addFields({ name: 'Tool rounds', value: String(data.toolRounds), inline: true });
  }

  return embed;
}
