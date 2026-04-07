import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { config as loadDotEnv } from 'dotenv';
import YAML from 'yaml';

export interface ScopeGrantMatch {
  guild_ids?: string[];
  role_ids?: string[];
  role_names?: string[];
}

export interface ScopeGrant {
  match: ScopeGrantMatch;
  scopes: string[];
}

export type ModerationNoticeAction =
  | 'warn'
  | 'note'
  | 'timeout'
  | 'untimeout'
  | 'kick'
  | 'ban'
  | 'unban';

export interface ModerationNoticeTemplate {
  enabled: boolean;
  title: string;
  body: string;
}

export type PresenceActivityType = 'Playing' | 'Watching' | 'Listening' | 'Competing';

export interface PresenceActivityEntry {
  type: PresenceActivityType;
  /**
   * Supports tokens: {guild_count}, {member_count}, {command_count}
   */
  name: string;
}

export interface PresenceConfig {
  interval_ms: number;
  activities: PresenceActivityEntry[];
}

export interface Settings {
  bot: {
    token_env: string;
    client_id_env: string;
    guild_id_env?: string;
    status: 'online' | 'idle' | 'dnd' | 'invisible';
    allowed_guild_ids: string[];
    /** @deprecated Use bot.presence.activities instead. */
    activity: string;
    presence: PresenceConfig;
  };
  database: {
    path: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
  scopes: {
    defaults: string[];
    grants: ScopeGrant[];
  };
  integrations: {
    seasonal_agent: {
      enabled: boolean;
      base_url: string;
      timeout_ms: number;
      bot_token_env: string;
    };
  };
  agents: {
    max_question_length: number;
    session_mode: 'per_user_in_channel';
    default_target: 'seasonalnet' | 'homelab';
  };
  moderation: {
    max_purge_count: number;
    lock_reason: string;
    unlock_reason: string;
    dm_notices: {
      enabled: boolean;
      footer: string;
      actions: Record<ModerationNoticeAction, ModerationNoticeTemplate>;
    };
  };
  cdn: {
    /** Base URL for the SeasonalNet icon CDN. Defaults to https://cdn.seasonalnet.org */
    icon_base_url: string;
  };
}

const DEFAULT_NOTICE_ACTIONS: Record<ModerationNoticeAction, ModerationNoticeTemplate> = {
  warn: {
    enabled: true,
    title: 'SeasonalNet moderation notice',
    body: [
      'A moderation action was recorded in **{guild_name}**.',
      '',
      'Action: **{action_label}**',
      'Reason: {reason}',
      'Moderator: {moderator_tag}',
      'Case: #{case_id}',
    ].join('\n'),
  },
  note: {
    enabled: true,
    title: 'SeasonalNet moderation note',
    body: [
      'A moderator recorded a note for your account in **{guild_name}**.',
      '',
      'Action: **{action_label}**',
      'Reason: {reason}',
      'Moderator: {moderator_tag}',
      'Case: #{case_id}',
    ].join('\n'),
  },
  timeout: {
    enabled: true,
    title: 'SeasonalNet timeout notice',
    body: [
      'You were timed out in **{guild_name}**.',
      '',
      'Action: **{action_label}**',
      'Duration: {duration_minutes} minute(s)',
      'Reason: {reason}',
      'Moderator: {moderator_tag}',
      'Case: #{case_id}',
    ].join('\n'),
  },
  untimeout: {
    enabled: true,
    title: 'SeasonalNet timeout update',
    body: [
      'Your timeout in **{guild_name}** was cleared.',
      '',
      'Action: **{action_label}**',
      'Reason: {reason}',
      'Moderator: {moderator_tag}',
      'Case: #{case_id}',
    ].join('\n'),
  },
  kick: {
    enabled: true,
    title: 'SeasonalNet removal notice',
    body: [
      'You were removed from **{guild_name}**.',
      '',
      'Action: **{action_label}**',
      'Reason: {reason}',
      'Moderator: {moderator_tag}',
      'Case: #{case_id}',
    ].join('\n'),
  },
  ban: {
    enabled: true,
    title: 'SeasonalNet ban notice',
    body: [
      'You were banned from **{guild_name}**.',
      '',
      'Action: **{action_label}**',
      'Reason: {reason}',
      'Moderator: {moderator_tag}',
      'Case: #{case_id}',
    ].join('\n'),
  },
  unban: {
    enabled: true,
    title: 'SeasonalNet unban notice',
    body: [
      'Your ban in **{guild_name}** was lifted.',
      '',
      'Action: **{action_label}**',
      'Reason: {reason}',
      'Moderator: {moderator_tag}',
      'Case: #{case_id}',
    ].join('\n'),
  },
};

const DEFAULT_PRESENCE: PresenceConfig = {
  interval_ms: 30_000,
  activities: [
    { type: 'Watching', name: 'SeasonalNet' },
  ],
};

const DEFAULTS: Settings = {
  bot: {
    token_env: 'SEASONALNET_BOT_TOKEN',
    client_id_env: 'SEASONALNET_BOT_CLIENT_ID',
    guild_id_env: 'SEASONALNET_BOT_GUILD_ID',
    activity: 'SeasonalNet workflows',
    status: 'online',
    allowed_guild_ids: [],
    presence: DEFAULT_PRESENCE,
  },
  database: {
    path: './var/seasonalnet_bot.db',
  },
  logging: {
    level: 'info',
  },
  scopes: {
    defaults: ['utility.use'],
    grants: [],
  },
  integrations: {
    seasonal_agent: {
      enabled: true,
      base_url: 'http://127.0.0.1:8765',
      timeout_ms: 30_000,
      bot_token_env: 'SEASONAL_AGENT_BOT_TOKEN',
    },
  },
  agents: {
    max_question_length: 1500,
    session_mode: 'per_user_in_channel',
    default_target: 'seasonalnet',
  },
  moderation: {
    max_purge_count: 100,
    lock_reason: 'Locked by SeasonalNet bot',
    unlock_reason: 'Unlocked by SeasonalNet bot',
    dm_notices: {
      enabled: true,
      footer: 'If you believe this action was made in error, contact the server staff.',
      actions: DEFAULT_NOTICE_ACTIONS,
    },
  },
  cdn: {
    icon_base_url: 'https://cdn.seasonalnet.org',
  },
};

export function resolveConfigPath(): string {
  const fromEnv = process.env.SEASONALNET_BOT_CONFIG;
  return path.resolve(fromEnv ?? './config.yaml');
}

function mergeNoticeActions(
  parsedActions: Partial<Record<ModerationNoticeAction, Partial<ModerationNoticeTemplate>>> | undefined,
): Record<ModerationNoticeAction, ModerationNoticeTemplate> {
  return {
    warn: { ...DEFAULT_NOTICE_ACTIONS.warn, ...(parsedActions?.warn ?? {}) },
    note: { ...DEFAULT_NOTICE_ACTIONS.note, ...(parsedActions?.note ?? {}) },
    timeout: { ...DEFAULT_NOTICE_ACTIONS.timeout, ...(parsedActions?.timeout ?? {}) },
    untimeout: { ...DEFAULT_NOTICE_ACTIONS.untimeout, ...(parsedActions?.untimeout ?? {}) },
    kick: { ...DEFAULT_NOTICE_ACTIONS.kick, ...(parsedActions?.kick ?? {}) },
    ban: { ...DEFAULT_NOTICE_ACTIONS.ban, ...(parsedActions?.ban ?? {}) },
    unban: { ...DEFAULT_NOTICE_ACTIONS.unban, ...(parsedActions?.unban ?? {}) },
  };
}

export function loadSettings(): Settings {
  loadDotEnv();

  const configPath = resolveConfigPath();
  let parsed: Partial<Settings> = {};
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    parsed = YAML.parse(raw) as Partial<Settings>;
  }

  const merged: Settings = {
    ...DEFAULTS,
    ...parsed,
    bot: (() => {
      const pb: Partial<Settings['bot']> = parsed.bot ?? {};
      let presence: PresenceConfig;
      if (pb.presence) {
        presence = { interval_ms: pb.presence.interval_ms ?? DEFAULT_PRESENCE.interval_ms, activities: pb.presence.activities ?? DEFAULT_PRESENCE.activities };
      } else if (pb.activity) {
        presence = { interval_ms: DEFAULT_PRESENCE.interval_ms, activities: [{ type: 'Playing', name: pb.activity }] };
      } else {
        presence = DEFAULT_PRESENCE;
      }
      return { ...DEFAULTS.bot, ...pb, presence };
    })(),
    database: { ...DEFAULTS.database, ...(parsed.database ?? {}) },
    logging: { ...DEFAULTS.logging, ...(parsed.logging ?? {}) },
    scopes: {
      defaults: parsed.scopes?.defaults ?? DEFAULTS.scopes.defaults,
      grants: parsed.scopes?.grants ?? DEFAULTS.scopes.grants,
    },
    integrations: {
      seasonal_agent: {
        ...DEFAULTS.integrations.seasonal_agent,
        ...(parsed.integrations?.seasonal_agent ?? {}),
      },
    },
    agents: { ...DEFAULTS.agents, ...(parsed.agents ?? {}) },
    moderation: {
      ...DEFAULTS.moderation,
      ...(parsed.moderation ?? {}),
      dm_notices: {
        ...DEFAULTS.moderation.dm_notices,
        ...(parsed.moderation?.dm_notices ?? {}),
        actions: mergeNoticeActions(parsed.moderation?.dm_notices?.actions),
      },
    },
    cdn: { ...DEFAULTS.cdn, ...(parsed.cdn ?? {}) },
  };

  const levelOverride = process.env.SEASONALNET_BOT_LOG_LEVEL as Settings['logging']['level'] | undefined;
  if (levelOverride) {
    merged.logging.level = levelOverride;
  }

  return merged;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
