import type { User } from 'discord.js';

import type { Settings, ModerationNoticeAction } from '../../core/config.js';
import { moderationNoticeEmbed } from '../../ui/embeds.js';

export interface ModerationNoticeData {
  action: ModerationNoticeAction;
  actionLabel: string;
  guildName: string;
  moderatorTag: string;
  moderatorId: string;
  targetTag: string;
  targetId: string;
  caseId: number;
  reason?: string;
  durationMinutes?: number;
}

export interface ModerationNoticeAttempt {
  attempted: boolean;
  delivered: boolean;
  error?: string;
}

export interface ModerationNoticeContent {
  title: string;
  body: string;
  footer?: string;
}

function fillTemplate(template: string, data: ModerationNoticeData): string {
  const values: Record<string, string> = {
    action: data.action,
    action_label: data.actionLabel,
    guild_name: data.guildName,
    moderator_tag: data.moderatorTag,
    moderator_id: data.moderatorId,
    target_tag: data.targetTag,
    target_id: data.targetId,
    case_id: String(data.caseId),
    reason: data.reason?.trim() || 'No reason provided.',
    duration_minutes: data.durationMinutes !== undefined ? String(data.durationMinutes) : 'n/a',
  };

  return template.replace(/\{([a-z_]+)\}/g, (_match, token: string) => values[token] ?? `{${token}}`);
}

export function buildModerationNotice(settings: Settings, data: ModerationNoticeData): ModerationNoticeContent | null {
  const noticeSettings = settings.moderation.dm_notices;
  if (!noticeSettings.enabled) {
    return null;
  }

  const template = noticeSettings.actions[data.action];
  if (!template?.enabled) {
    return null;
  }

  return {
    title: fillTemplate(template.title, data),
    body: fillTemplate(template.body, data),
    footer: noticeSettings.footer.trim() || undefined,
  };
}

export async function sendModerationNotice(
  settings: Settings,
  targetUser: User,
  data: ModerationNoticeData,
): Promise<ModerationNoticeAttempt> {
  const notice = buildModerationNotice(settings, data);
  if (!notice) {
    return {
      attempted: false,
      delivered: false,
    };
  }

  try {
    await targetUser.send({
      embeds: [
        moderationNoticeEmbed(data.action, notice.title, notice.body, notice.footer),
      ],
    });

    return {
      attempted: true,
      delivered: true,
    };
  } catch (error) {
    return {
      attempted: true,
      delivered: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
