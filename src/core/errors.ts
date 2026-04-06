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
