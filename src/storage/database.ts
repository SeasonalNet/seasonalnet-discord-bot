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

export interface CommandAuditRecord {
  id: number;
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
  createdAt: string;
}

export interface ModerationActionRecord {
  id: number;
  actionName: string;
  userId: string;
  username: string;
  guildId?: string;
  channelId?: string;
  targetUserId?: string;
  targetUsername?: string;
  detailsJson?: string;
  createdAt: string;
}

interface SqlCommandAuditRow {
  id: number;
  command_name: string;
  user_id: string;
  username: string;
  guild_id: string | null;
  channel_id: string | null;
  success: number;
  latency_ms: number;
  error_code: string | null;
  error_message: string | null;
  correlation_id: string;
  created_at: string;
}

interface SqlModerationActionRow {
  id: number;
  action_name: string;
  user_id: string;
  username: string;
  guild_id: string | null;
  channel_id: string | null;
  target_user_id: string | null;
  target_username: string | null;
  details_json: string | null;
  created_at: string;
}

function mapCommandAuditRow(row: SqlCommandAuditRow): CommandAuditRecord {
  return {
    id: row.id,
    commandName: row.command_name,
    userId: row.user_id,
    username: row.username,
    guildId: row.guild_id ?? undefined,
    channelId: row.channel_id ?? undefined,
    success: row.success === 1,
    latencyMs: row.latency_ms,
    errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    correlationId: row.correlation_id,
    createdAt: row.created_at,
  };
}

function mapModerationActionRow(row: SqlModerationActionRow): ModerationActionRecord {
  return {
    id: row.id,
    actionName: row.action_name,
    userId: row.user_id,
    username: row.username,
    guildId: row.guild_id ?? undefined,
    channelId: row.channel_id ?? undefined,
    targetUserId: row.target_user_id ?? undefined,
    targetUsername: row.target_username ?? undefined,
    detailsJson: row.details_json ?? undefined,
    createdAt: row.created_at,
  };
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

  logModerationAction(input: ModerationAuditInput): number {
    const statement = this.db.prepare(`
      INSERT INTO moderation_actions (
        action_name, user_id, username, guild_id, channel_id,
        target_user_id, target_username, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = statement.run(
      input.actionName,
      input.userId,
      input.username,
      input.guildId ?? null,
      input.channelId ?? null,
      input.targetUserId ?? null,
      input.targetUsername ?? null,
      input.detailsJson ?? null,
    );

    return Number(result.lastInsertRowid);
  }

  getRecentCommandAudit(limit: number, userId?: string): CommandAuditRecord[] {
    const normalizedLimit = Math.max(1, Math.min(limit, 25));
    if (userId) {
      const rows = this.db.prepare(`
        SELECT id, command_name, user_id, username, guild_id, channel_id,
               success, latency_ms, error_code, error_message, correlation_id, created_at
        FROM command_audit
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ?
      `).all(userId, normalizedLimit) as unknown as SqlCommandAuditRow[];
      return rows.map(mapCommandAuditRow);
    }

    const rows = this.db.prepare(`
      SELECT id, command_name, user_id, username, guild_id, channel_id,
             success, latency_ms, error_code, error_message, correlation_id, created_at
      FROM command_audit
      ORDER BY id DESC
      LIMIT ?
    `).all(normalizedLimit) as unknown as SqlCommandAuditRow[];
    return rows.map(mapCommandAuditRow);
  }

  getRecentModerationActions(limit: number, targetUserId?: string): ModerationActionRecord[] {
    const normalizedLimit = Math.max(1, Math.min(limit, 25));
    if (targetUserId) {
      const rows = this.db.prepare(`
        SELECT id, action_name, user_id, username, guild_id, channel_id,
               target_user_id, target_username, details_json, created_at
        FROM moderation_actions
        WHERE target_user_id = ?
        ORDER BY id DESC
        LIMIT ?
      `).all(targetUserId, normalizedLimit) as unknown as SqlModerationActionRow[];
      return rows.map(mapModerationActionRow);
    }

    const rows = this.db.prepare(`
      SELECT id, action_name, user_id, username, guild_id, channel_id,
             target_user_id, target_username, details_json, created_at
      FROM moderation_actions
      ORDER BY id DESC
      LIMIT ?
    `).all(normalizedLimit) as unknown as SqlModerationActionRow[];
    return rows.map(mapModerationActionRow);
  }

  getModerationActionById(id: number): ModerationActionRecord | null {
    const row = this.db.prepare(`
      SELECT id, action_name, user_id, username, guild_id, channel_id,
             target_user_id, target_username, details_json, created_at
      FROM moderation_actions
      WHERE id = ?
      LIMIT 1
    `).get(id) as SqlModerationActionRow | undefined;

    return row ? mapModerationActionRow(row) : null;
  }


  updateModerationActionDetails(id: number, detailsJson: string): void {
    this.db.prepare(`
      UPDATE moderation_actions
      SET details_json = ?
      WHERE id = ?
    `).run(detailsJson, id);
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
