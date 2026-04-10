import type { ChatInputCommandInteraction } from 'discord.js';

import type { AppContext } from '../../core/app-context.js';
import type { AgentTargetSettings, Settings } from '../../core/config.js';
import type { BotChatResponse } from '../../integrations/seasonal-agent.js';

export type AgentTargetId = string;

export interface ResolvedAgentTarget {
  readonly id: AgentTargetId;
  readonly display_name: string;
  readonly description: string;
  readonly agent_profile: string;
  readonly enabled: boolean;
}

export function listEnabledAgentTargets(settings: Settings): ResolvedAgentTarget[] {
  return Object.entries(settings.agents.targets)
    .filter(([, target]) => target.enabled)
    .map(([id, target]) => ({
      id,
      ...target,
    }));
}

export function resolveAgentTarget(settings: Settings, targetId: AgentTargetId): ResolvedAgentTarget {
  const target = settings.agents.targets[targetId];
  if (!target || !target.enabled) {
    throw new Error(`Unknown or disabled agent target: ${targetId}`);
  }

  return {
    id: targetId,
    ...target,
  };
}

export function buildSessionId(interaction: ChatInputCommandInteraction, target: AgentTargetId): string {
  const guildId = interaction.guildId ?? 'dm';
  const channelId = interaction.channelId;
  const userId = interaction.user.id;
  return `discord:${guildId}:${channelId}:${userId}:target:${target}`;
}

export async function askAgent(
  context: AppContext,
  interaction: ChatInputCommandInteraction,
  targetId: AgentTargetId,
  question: string,
): Promise<BotChatResponse> {
  const target = resolveAgentTarget(context.settings, targetId);
  const sessionId = buildSessionId(interaction, target.id);

  context.database.touchAgentSession(
    sessionId,
    target.id,
    interaction.user.id,
    interaction.guildId ?? undefined,
    interaction.channelId ?? undefined,
  );

  const channelName = interaction.channel && 'name' in interaction.channel
    ? (interaction.channel.name ?? undefined)
    : undefined;

  return context.seasonalAgent.botChat({
    message: question,
    session_id: sessionId,
    persist_history: true,
    target: target.id,
    agent_profile: target.agent_profile,
    user_id: interaction.user.id,
    user_name: interaction.user.username,
    guild_id: interaction.guildId ?? undefined,
    guild_name: interaction.guild?.name ?? undefined,
    channel_id: interaction.channelId ?? undefined,
    channel_name: channelName,
    metadata: {
      source: 'seasonalnet-discord-bot',
      transport: 'discord-slash-command',
      session_mode: context.settings.agents.session_mode,
      requested_target: target.id,
      target_display_name: target.display_name,
      resolved_agent_profile: target.agent_profile,
    },
  });
}
