import type { User } from 'discord.js';

import type { Settings, ModerationNoticeAction } from '../../core/config.js';

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

export function buildModerationNotice(settings: Settings, data: ModerationNoticeData): string | null {
  const noticeSettings = settings.moderation.dm_notices;
  if (!noticeSettings.enabled) {
    return null;
  }

  const template = noticeSettings.actions[data.action];
  if (!template?.enabled) {
    return null;
  }

  const title = fillTemplate(template.title, data);
  const body = fillTemplate(template.body, data);
  const footer = noticeSettings.footer.trim();

  return [
    `**${title}**`,
    '',
    body,
    ...(footer ? ['', footer] : []),
  ].join('\n');
}

export async function sendModerationNotice(
  settings: Settings,
  targetUser: User,
  data: ModerationNoticeData,
): Promise<ModerationNoticeAttempt> {
  const content = buildModerationNotice(settings, data);
  if (!content) {
    return {
      attempted: false,
      delivered: false,
    };
  }

  try {
    await targetUser.send({ content });
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
