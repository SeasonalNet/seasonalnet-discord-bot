export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  constructor(private readonly level: LogLevel) {}

  child(bindings: Record<string, unknown>): Logger {
    return new ChildLogger(this, bindings);
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.log('debug', message, fields);
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.log('info', message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.log('warn', message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.log('error', message, fields);
  }

  log(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (ORDER[level] < ORDER[this.level]) {
      return;
    }

    const payload = {
      level,
      time: new Date().toISOString(),
      message,
      ...(fields ?? {}),
    };

    const line = JSON.stringify(payload);
    if (level === 'error') {
      console.error(line);
      return;
    }
    if (level === 'warn') {
      console.warn(line);
      return;
    }
    console.log(line);
  }
}

class ChildLogger extends Logger {
  constructor(
    private readonly parentLogger: Logger,
    private readonly bindings: Record<string, unknown>,
  ) {
    super('debug');
  }

  override log(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    this.parentLogger.log(level, message, { ...this.bindings, ...(fields ?? {}) });
  }
}
