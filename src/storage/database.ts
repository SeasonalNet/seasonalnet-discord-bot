import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from './migrations.js';

interface CommandAuditInput {
  commandName: string;
  userId: string;
  username: string;
  guildId?: string;
  channelId?: string;
  success: boolean;
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
  correlationId: string;
}

interface ModerationAuditInput {
  actionName: string;
  userId: string;
  username: string;
  guildId?: string;
  channelId?: string;
  targetUserId?: string;
  targetUsername?: string;
  detailsJson?: string;
}

export class Database {
  private readonly db: DatabaseSync;

  constructor(private readonly filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.ensureMigrationTable();
    this.applyMigrations();
  }

  get path(): string {
    return this.filePath;
  }

  close(): void {
    this.db.close();
  }

  logCommand(input: CommandAuditInput): void {
    const statement = this.db.prepare(`
      INSERT INTO command_audit (
        command_name, user_id, username, guild_id, channel_id,
        success, latency_ms, error_code, error_message, correlation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    statement.run(
      input.commandName,
      input.userId,
      input.username,
      input.guildId ?? null,
      input.channelId ?? null,
      input.success ? 1 : 0,
      input.latencyMs,
      input.errorCode ?? null,
      input.errorMessage ?? null,
      input.correlationId,
    );
  }

  logModerationAction(input: ModerationAuditInput): void {
    const statement = this.db.prepare(`
      INSERT INTO moderation_actions (
        action_name, user_id, username, guild_id, channel_id,
        target_user_id, target_username, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    statement.run(
      input.actionName,
      input.userId,
      input.username,
      input.guildId ?? null,
      input.channelId ?? null,
      input.targetUserId ?? null,
      input.targetUsername ?? null,
      input.detailsJson ?? null,
    );
  }

  touchAgentSession(sessionId: string, target: string, userId: string, guildId?: string, channelId?: string): void {
    const statement = this.db.prepare(`
      INSERT INTO agent_sessions (
        session_id, target, user_id, guild_id, channel_id, last_used_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(session_id) DO UPDATE SET
        target = excluded.target,
        user_id = excluded.user_id,
        guild_id = excluded.guild_id,
        channel_id = excluded.channel_id,
        last_used_at = CURRENT_TIMESTAMP
    `);

    statement.run(
      sessionId,
      target,
      userId,
      guildId ?? null,
      channelId ?? null,
    );
  }

  private ensureMigrationTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private applyMigrations(): void {
    for (const migration of MIGRATIONS) {
      const existing = this.db.prepare('SELECT 1 AS present FROM schema_migrations WHERE name = ?').get(migration.name) as { present?: number } | undefined;
      if (existing?.present === 1) {
        continue;
      }

      this.db.exec(migration.sql);
      this.db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(migration.name);
    }
  }
}
