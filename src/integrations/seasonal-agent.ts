import { JsonHttpClient } from '../core/http.js';

export interface BotChatRequest {
  message: string;
  session_id: string;
  persist_history: boolean;
  agent_profile?: string;
  target?: string;
  user_id?: string;
  user_name?: string;
  channel_id?: string;
  channel_name?: string;
  guild_id?: string;
  guild_name?: string;
  metadata?: Record<string, unknown>;
}

export interface BotChatResponse {
  ok: boolean;
  session_id: string;
  reply: string;
  assistant_message: string;
  tool_rounds: number;
  used_tools: string[];
  created_at: string;
  model: string;
  profile_id?: string;
  profile_display_name?: string;
}

export class SeasonalAgentClient {
  private readonly http: JsonHttpClient;

  constructor(
    private readonly upstreamBaseUrl: string,
    token: string,
    timeoutMs: number,
  ) {
    this.http = new JsonHttpClient(
      upstreamBaseUrl,
      {
        authorization: `Bearer ${token}`,
      },
      timeoutMs,
    );
  }

  async health(): Promise<'ok' | 'error'> {
    const response = await fetch(new URL('/healthz', this.upstreamBaseUrl));
    return response.ok ? 'ok' : 'error';
  }

  async botChat(body: BotChatRequest): Promise<BotChatResponse> {
    return this.http.post<BotChatResponse>('/api/v1/bot/chat', body);
  }
}
