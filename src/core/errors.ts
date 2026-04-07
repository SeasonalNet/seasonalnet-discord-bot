export class BotError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'BotError';
    this.code = code;
    this.details = details;
  }
}

export class ScopeError extends BotError {
  constructor(scope: string) {
    super('SCOPE_DENIED', `Missing required scope: ${scope}`, { scope });
    this.name = 'ScopeError';
  }
}

export class UpstreamServiceError extends BotError {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number, details?: Record<string, unknown>) {
    super('UPSTREAM_ERROR', message, details);
    this.name = 'UpstreamServiceError';
    this.statusCode = statusCode;
  }
}


export class GuildAccessError extends BotError {
  constructor(guildId?: string) {
    super(
      'GUILD_ACCESS_DENIED',
      guildId ? `Bot is not enabled in guild ${guildId}` : 'Bot is not enabled in this guild.',
      guildId ? { guildId } : undefined,
    );
    this.name = 'GuildAccessError';
  }
}

export class GuildOnlyError extends BotError {
  constructor(commandName: string) {
    super('GUILD_ONLY_COMMAND', `The ${commandName} command can only be used inside a guild.`, { commandName });
    this.name = 'GuildOnlyError';
  }
}
