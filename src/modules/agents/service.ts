import type { ChatInputCommandInteraction } from 'discord.js';

import type { AppContext } from '../../core/app-context.js';
import type { BotChatResponse } from '../../integrations/seasonal-agent.js';

export type AgentTarget = 'seasonalnet' | 'homelab';

export function buildSessionId(interaction: ChatInputCommandInteraction, target: AgentTarget): string {
  const guildId = interaction.guildId ?? 'dm';
  const channelId = interaction.channelId;
  const userId = interaction.user.id;
  return `discord:${guildId}:${channelId}:${userId}:target:${target}`;
}

export async function askAgent(
  context: AppContext,
  interaction: ChatInputCommandInteraction,
  target: AgentTarget,
  question: string,
): Promise<BotChatResponse> {
  const sessionId = buildSessionId(interaction, target);

  context.database.touchAgentSession(
    sessionId,
    target,
    interaction.user.id,
    interaction.guildId ?? undefined,
    interaction.channelId ?? undefined,
  );

  return context.seasonalAgent.botChat({
    message: question,
    session_id: sessionId,
    persist_history: true,
  });
}
