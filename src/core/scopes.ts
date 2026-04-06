import type { GuildMember } from 'discord.js';

import type { ScopeGrant, Settings } from './config.js';

function grantMatches(grant: ScopeGrant, member: GuildMember | null): boolean {
  if (!member) {
    return false;
  }

  const roleIds = new Set(member.roles.cache.keys());
  const roleNames = new Set(member.roles.cache.map((role) => role.name));

  const wantsRoleId = (grant.match.role_ids ?? []).some((roleId) => roleIds.has(roleId));
  const wantsRoleName = (grant.match.role_names ?? []).some((roleName) => roleNames.has(roleName));

  return wantsRoleId || wantsRoleName;
}

export function resolveScopes(settings: Settings, member: GuildMember | null): Set<string> {
  const scopes = new Set<string>(settings.scopes.defaults);

  if (member?.permissions.has('Administrator')) {
    scopes.add('*');
    return scopes;
  }

  for (const grant of settings.scopes.grants) {
    if (grantMatches(grant, member)) {
      for (const scope of grant.scopes) {
        scopes.add(scope);
      }
    }
  }

  return scopes;
}

export function hasScope(scopes: Set<string>, requiredScope: string): boolean {
  return scopes.has('*') || scopes.has(requiredScope);
}
