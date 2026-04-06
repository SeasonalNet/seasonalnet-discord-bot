import { UpstreamServiceError } from './errors.js';

function serializeCause(cause: unknown): unknown {
  if (cause && typeof cause === 'object') {
    try {
      return JSON.parse(JSON.stringify(cause, Object.getOwnPropertyNames(cause)));
    } catch {
      return String(cause);
    }
  }

  return cause;
}

export class JsonHttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultHeaders: Record<string, string> = {},
    private readonly timeoutMs = 30_000,
  ) {}

  async get<T>(pathname: string): Promise<T> {
    const response = await this.request(pathname, { method: 'GET' });
    return response as T;
  }

  async post<T>(pathname: string, body: unknown): Promise<T> {
    const response = await this.request(pathname, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response as T;
  }

  private async request(pathname: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(new URL(pathname, this.baseUrl), {
        ...init,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          ...this.defaultHeaders,
          ...(init.headers ?? {}),
        },
      });

      const text = await response.text();
      let payload: unknown = undefined;

      if (text.length > 0) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { raw: text };
        }
      }

      if (!response.ok) {
        throw new UpstreamServiceError(
          `Upstream request failed with status ${response.status}.`,
          response.status,
          typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : { payload },
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof UpstreamServiceError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new UpstreamServiceError('Upstream request timed out.');
      }

      const cause =
        error instanceof Error && 'cause' in error
          ? (error as Error & { cause?: unknown }).cause
          : undefined;

      throw new UpstreamServiceError('Failed to reach upstream service.', undefined, {
        error: error instanceof Error ? error.message : String(error),
        cause: serializeCause(cause),
        baseUrl: this.baseUrl,
        pathname,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
