import { ActivityType, type Client } from 'discord.js';

import type { PresenceActivityEntry } from './config.js';
import type { Database } from '../storage/database.js';
import type { Logger } from './logger.js';

const ACTIVITY_TYPE_MAP: Record<string, ActivityType> = {
  Playing: ActivityType.Playing,
  Watching: ActivityType.Watching,
  Listening: ActivityType.Listening,
  Competing: ActivityType.Competing,
};

function resolveTokens(template: string, client: Client, database: Database): string {
  return template
    .replace('{guild_count}', String(client.guilds.cache.size))
    .replace('{member_count}', String(
      client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0),
    ))
    .replace('{command_count}', String(database.commandCount()));
}

export class PresenceRotator {
  private readonly activities: PresenceActivityEntry[];
  private readonly intervalMs: number;
  private readonly client: Client;
  private readonly database: Database;
  private readonly logger: Logger;
  private index = 0;
  private handle: ReturnType<typeof setInterval> | null = null;

  constructor(
    activities: PresenceActivityEntry[],
    intervalMs: number,
    client: Client,
    database: Database,
    logger: Logger,
  ) {
    this.activities = activities.length > 0 ? activities : [{ type: 'Playing', name: 'SeasonalNet' }];
    this.intervalMs = Math.max(intervalMs, 10_000);
    this.client = client;
    this.database = database;
    this.logger = logger;
  }

  start(): void {
    this.apply();

    if (this.activities.length > 1) {
      this.handle = setInterval(() => {
        this.index = (this.index + 1) % this.activities.length;
        this.apply();
      }, this.intervalMs);
    }
  }

  stop(): void {
    if (this.handle !== null) {
      clearInterval(this.handle);
      this.handle = null;
    }
  }

  private apply(): void {
    const entry = this.activities[this.index];
    if (!entry || !this.client.user) {
      return;
    }

    const name = resolveTokens(entry.name, this.client, this.database);
    const type = ACTIVITY_TYPE_MAP[entry.type] ?? ActivityType.Playing;

    this.client.user.setActivity({ name, type });

    this.logger.debug('Presence updated.', { name, type: entry.type });
  }
}
