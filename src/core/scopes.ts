import { GuildMember, type ChatInputCommandInteraction } from 'discord.js';

import type { ScopeGrant, Settings } from './config.js';

function grantMatches(grant: ScopeGrant, member: GuildMember | null): boolean {
  if (!member) {
    return false;
  }

  const guildIds = grant.match.guild_ids ?? [];
  if (guildIds.length > 0 && !guildIds.includes(member.guild.id)) {
    return false;
  }

  const roleIds = new Set(member.roles.cache.keys());
  const roleNames = new Set(member.roles.cache.map((role) => role.name));

  const wantsRoleId = (grant.match.role_ids ?? []).some((roleId) => roleIds.has(roleId));
  const wantsRoleName = (grant.match.role_names ?? []).some((roleName) => roleNames.has(roleName));

  return wantsRoleId || wantsRoleName;
}

const IMPLIED_SCOPES: Record<string, string[]> = {
  'moderation.manage': [
    'moderation.lock',
    'moderation.slowmode',
    'moderation.purge',
    'moderation.timeout',
  ],
};

export function resolveScopes(settings: Settings, member: GuildMember | null): Set<string> {
  const scopes = new Set<string>(settings.scopes.defaults);

  for (const grant of settings.scopes.grants) {
    if (grantMatches(grant, member)) {
      for (const scope of grant.scopes) {
        scopes.add(scope);
      }
    }
  }

  return scopes;
}

export function resolveInteractionScopes(
  settings: Settings,
  interaction: ChatInputCommandInteraction,
): Set<string> {
  const member = interaction.member instanceof GuildMember ? interaction.member : null;
  return resolveScopes(settings, member);
}

export function hasScope(scopes: Set<string>, requiredScope: string): boolean {
  if (scopes.has('*') || scopes.has(requiredScope)) {
    return true;
  }

  return [...scopes].some((scope) => (IMPLIED_SCOPES[scope] ?? []).includes(requiredScope));
}
