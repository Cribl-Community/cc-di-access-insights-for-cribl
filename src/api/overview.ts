import { isOrgAdmin, resolveGroupAdminReach } from './access';
import type { ConfigGroup, Role, Team, TeamAccess, User, UserAccess, UserIdentity } from './types';

export type AuthKind = 'saml' | 'sso' | 'local' | 'credential';

/**
 * How an account authenticates.
 * - `credential` — an API credential, not a person.
 * - `saml` — has a SAML federated identity.
 * - `sso` — SSO by some other means (OIDC identity, or Cloud `SINGLE_SIGN_ON`).
 * - `local` — username/password, or no SSO signal at all.
 */
export function classifyAuth(user: User): AuthKind {
  if (user.type === 'credential' || user.id.endsWith('@clients')) return 'credential';

  const identities = user.federated_identities ?? [];
  if (identities.some((i) => i.kind === 'SAML')) return 'saml';
  if (identities.some((i) => i.kind === 'OIDC')) return 'sso';
  if (user.cloudMetadata?.identityType === 'SINGLE_SIGN_ON') return 'sso';
  if ((user.cloudMetadata?.ssoGroups ?? []).length > 0) return 'sso';

  return 'local';
}

export interface AuthDescription {
  kind: AuthKind;
  /** Short badge text, e.g. "SAML SSO" / "SSO" / "Local" / "API key". */
  label: string;
  /** One-line explanation for the detail panel; empty for an unremarkable local account. */
  detail: string;
  /** IdP connection ids seen on the account. */
  connections: string[];
  /** Federated identities linked to the account (empty for local / credential). */
  identities: UserIdentity[];
  /** IdP group names this account matched (`cloudMetadata.ssoGroups`). */
  idpGroups: string[];
}

/**
 * A fuller picture of how an account authenticates — the badge label plus the
 * federated-identity / IdP-group evidence behind it. Every field degrades to
 * empty when the deployment doesn't report SSO data.
 */
export function describeAuth(user: User): AuthDescription {
  const kind = classifyAuth(user);
  const identities = (user.federated_identities ?? []).filter((i) => i.kind !== 'PASSWORD');
  const connections = [...new Set(identities.map((i) => i.connectionId).filter(Boolean))];
  const idpGroups = user.cloudMetadata?.ssoGroups ?? [];

  const viaConnection = connections.length > 0 ? ` via IdP connection ${connections.join(', ')}` : '';
  switch (kind) {
    case 'credential':
      return { kind, label: 'API key', detail: 'Machine-to-machine API credential — not a person.', connections, identities, idpGroups };
    case 'saml':
      return { kind, label: 'SAML SSO', detail: `Signs in through SAML single sign-on${viaConnection}.`, connections, identities, idpGroups };
    case 'sso': {
      const oidc = identities.some((i) => i.kind === 'OIDC');
      return {
        kind,
        label: oidc ? 'OIDC SSO' : 'SSO',
        detail: `Signs in through ${oidc ? 'OIDC ' : ''}single sign-on${viaConnection}.`,
        connections,
        identities,
        idpGroups,
      };
    }
    default:
      return { kind, label: 'Local', detail: '', connections, identities, idpGroups };
  }
}

/** True when a Team's membership/permissions are driven by IdP group mapping ("Mapping IDs"). */
export function isIdpMappedTeam(team: Team): boolean {
  return (team.ssoGroupIds ?? []).length > 0;
}

type ResolveUserAccess = (user: User) => UserAccess;
type ResolveTeamAccess = (team: Team) => TeamAccess;

// --- Named filters -----------------------------------------------------------
// The Overview tiles link to `/users?filter=<key>` / `/teams?filter=<key>`; the
// list pages apply the matching predicate. Counts on the Overview page are
// derived from these same predicates so a tile's number always equals the number
// of rows its link lands on.

export type UserFilterKey =
  | 'org-admins'
  | 'workspace-admins'
  | 'saml'
  | 'sso'
  | 'local'
  | 'disabled'
  | 'no-team';

interface UserFilterDef {
  label: string;
  match: (user: User, resolveUserAccess: ResolveUserAccess) => boolean;
}

const isPerson = (u: User) => classifyAuth(u) !== 'credential';

export const USER_FILTERS: Record<UserFilterKey, UserFilterDef> = {
  'org-admins': {
    label: 'Organization admins',
    match: (u, a) => isPerson(u) && isOrgAdmin(a(u).effectiveRoles.map((r) => r.role.id)),
  },
  'workspace-admins': {
    label: 'Workspace admins',
    match: (u, a) => {
      if (!isPerson(u)) return false;
      return resolveGroupAdminReach(u, a(u).effectiveRoles).some((g) => g.scope === 'workspace');
    },
  },
  saml: { label: 'SAML users', match: (u) => classifyAuth(u) === 'saml' },
  sso: { label: 'Other SSO users', match: (u) => classifyAuth(u) === 'sso' },
  local: { label: 'Local users', match: (u) => classifyAuth(u) === 'local' },
  disabled: { label: 'Disabled users', match: (u) => isPerson(u) && u.disabled },
  'no-team': {
    label: 'Users in no team',
    match: (u, a) => isPerson(u) && a(u).teams.length === 0,
  },
};

export function isUserFilterKey(value: string | null | undefined): value is UserFilterKey {
  return value != null && value in USER_FILTERS;
}

export type TeamFilterKey = 'empty' | 'idp-mapped';

export const TEAM_FILTERS: Record<
  TeamFilterKey,
  { label: string; match: (team: Team, resolveTeamAccess: ResolveTeamAccess) => boolean }
> = {
  empty: {
    label: 'Empty teams',
    match: (t, a) => {
      const access = a(t);
      return access.members.length === 0 && access.unresolvedMembers.length === 0;
    },
  },
  'idp-mapped': { label: 'IdP-mapped teams', match: (t) => isIdpMappedTeam(t) },
};

export function isTeamFilterKey(value: string | null | undefined): value is TeamFilterKey {
  return value != null && value in TEAM_FILTERS;
}

// --- Overview stats --------------------------------------------------------

export interface OverviewStats {
  totalUsers: number;
  disabledUsers: number;
  apiCredentials: number;
  samlUsers: number;
  ssoUsers: number;
  localUsers: number;
  /** True when no account carried any SSO signal — the split is then a guess. */
  authUnknown: boolean;
  orgAdmins: number;
  workspaceAdmins: number;
  usersWithoutTeam: number;
  totalTeams: number;
  emptyTeams: number;
  /** Teams whose membership is driven by IdP group mapping ("Mapping IDs"). */
  idpMappedTeams: number;
  totalRoles: number;
  workerGroups: number;
}

interface OverviewInput {
  users: User[];
  teams: Team[];
  roles: Role[];
  groups: ConfigGroup[];
  resolveUserAccess: ResolveUserAccess;
  resolveTeamAccess: ResolveTeamAccess;
}

export function computeOverviewStats({
  users,
  teams,
  roles,
  groups,
  resolveUserAccess,
  resolveTeamAccess,
}: OverviewInput): OverviewStats {
  const people = users.filter(isPerson);
  const countUsers = (key: UserFilterKey) =>
    users.filter((u) => USER_FILTERS[key].match(u, resolveUserAccess)).length;

  const samlUsers = countUsers('saml');
  const ssoUsers = countUsers('sso');
  const localUsers = countUsers('local');

  return {
    totalUsers: people.length,
    disabledUsers: countUsers('disabled'),
    apiCredentials: users.length - people.length,
    samlUsers,
    ssoUsers,
    localUsers,
    authUnknown: people.length > 0 && samlUsers + ssoUsers === 0 && localUsers === people.length,
    orgAdmins: countUsers('org-admins'),
    workspaceAdmins: countUsers('workspace-admins'),
    usersWithoutTeam: countUsers('no-team'),
    totalTeams: teams.length,
    emptyTeams: teams.filter((t) => TEAM_FILTERS.empty.match(t, resolveTeamAccess)).length,
    idpMappedTeams: teams.filter(isIdpMappedTeam).length,
    totalRoles: roles.length,
    workerGroups: groups.length,
  };
}
