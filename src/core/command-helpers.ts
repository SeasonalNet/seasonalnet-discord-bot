import {
  ChatInputCommandInteraction,
  GuildMember,
    PermissionsBitField,
} from 'discord.js';

import { ScopeError } from './errors.js';
import { resolveInteractionScopes, hasScope } from './scopes.js';
import type { AppContext } from './app-context.js';

export function getGuildMember(interaction: ChatInputCommandInteraction): GuildMember | null {
  return interaction.member instanceof GuildMember ? interaction.member : null;
}

export function getInteractionScopes(context: AppContext, interaction: ChatInputCommandInteraction): Set<string> {
  return resolveInteractionScopes(context.settings, interaction);
}

export function ensureScope(context: AppContext, interaction: ChatInputCommandInteraction, requiredScope: string): void {
  const scopes = getInteractionScopes(context, interaction);
  if (!hasScope(scopes, requiredScope)) {
    throw new ScopeError(requiredScope);
  }
}

export function ensureDiscordPermission(
  interaction: ChatInputCommandInteraction,
  permission: bigint,
  message: string,
): void {
  const member = getGuildMember(interaction);
  if (!member || !member.permissions.has(permission)) {
    throw new Error(message);
  }
}

export async function replyEphemeral(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ content, flags: 'Ephemeral' });
    return;
  }

  await interaction.reply({ content, flags: 'Ephemeral' });
}

export const DiscordPermissions = PermissionsBitField.Flags;
