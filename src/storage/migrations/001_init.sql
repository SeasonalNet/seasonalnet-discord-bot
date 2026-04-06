CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS command_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  guild_id TEXT,
  channel_id TEXT,
  success INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  error_code TEXT,
  error_message TEXT,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  guild_id TEXT,
  channel_id TEXT,
  target_user_id TEXT,
  target_username TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  target TEXT NOT NULL,
  user_id TEXT NOT NULL,
  guild_id TEXT,
  channel_id TEXT,
  last_used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
