import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { config as loadDotEnv } from 'dotenv';
import YAML from 'yaml';

export interface ScopeGrantMatch {
  role_ids?: string[];
  role_names?: string[];
}

export interface ScopeGrant {
  match: ScopeGrantMatch;
  scopes: string[];
}

export interface Settings {
  bot: {
    token_env: string;
    client_id_env: string;
    guild_id_env?: string;
    activity: string;
    status: 'online' | 'idle' | 'dnd' | 'invisible';
    allowed_guild_ids: string[];
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
  };
}

const DEFAULTS: Settings = {
  bot: {
    token_env: 'SEASONALNET_BOT_TOKEN',
    client_id_env: 'SEASONALNET_BOT_CLIENT_ID',
    guild_id_env: 'SEASONALNET_BOT_GUILD_ID',
    activity: 'SeasonalNet workflows',
    status: 'online',
    allowed_guild_ids: [],
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
  },
};

export function resolveConfigPath(): string {
  const fromEnv = process.env.SEASONALNET_BOT_CONFIG;
  return path.resolve(fromEnv ?? './config.yaml');
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
    bot: { ...DEFAULTS.bot, ...(parsed.bot ?? {}) },
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
    moderation: { ...DEFAULTS.moderation, ...(parsed.moderation ?? {}) },
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
