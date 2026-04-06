import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionsBitField,
} from 'discord.js';

import { ScopeError } from './errors.js';
import { resolveScopes, hasScope } from './scopes.js';
import type { AppContext } from './app-context.js';

export function getGuildMember(interaction: ChatInputCommandInteraction): GuildMember | null {
  return interaction.member instanceof GuildMember ? interaction.member : null;
}

export function ensureScope(context: AppContext, interaction: ChatInputCommandInteraction, requiredScope: string): void {
  const member = getGuildMember(interaction);
  const scopes = resolveScopes(context.settings, member);
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
    await interaction.followUp({ content, ephemeral: true });
    return;
  }

  await interaction.reply({ content, ephemeral: true });
}

export const DiscordPermissions = PermissionsBitField.Flags;
