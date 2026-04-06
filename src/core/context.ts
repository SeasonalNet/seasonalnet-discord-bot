import { GuildMember, type ChatInputCommandInteraction } from 'discord.js';

export interface RequestContext {
  commandName: string;
  userId: string;
  username: string;
  guildId?: string;
  channelId?: string;
  roleIds: string[];
  roleNames: string[];
  permissionNames: string[];
  correlationId: string;
}

export function buildRequestContext(interaction: ChatInputCommandInteraction): RequestContext {
  const member = interaction.member instanceof GuildMember ? interaction.member : null;

  return {
    commandName: interaction.commandName,
    userId: interaction.user.id,
    username: interaction.user.tag,
    guildId: interaction.guildId ?? undefined,
    channelId: interaction.channelId ?? undefined,
    roleIds: member ? [...member.roles.cache.keys()] : [],
    roleNames: member ? member.roles.cache.map((role) => role.name) : [],
    permissionNames: member ? member.permissions.toArray() : [],
    correlationId: crypto.randomUUID(),
  };
}
