import {
  GROUP_KIND_LABELS,
  type AccessSource,
  type GroupAccess,
  type GroupAclResult,
  type GroupGrant,
  type Product,
  type ResourcePolicy,
  type Team,
  type TeamAccess,
  type User,
} from './types';

/**
 * Rank of a resource policy by its action, used to pick the strongest when
 * access to the same group arrives from several sources (direct + via a Team,
 * or from more than one product). Unknown actions rank 0 and never win a tie.
 */
const POLICY_RANK: Record<string, number> = {
  read: 1,
  base: 1,
  user: 1,
  write: 2,
  maintain: 3,
  deploy: 3,
  admin: 4,
  full: 4,
  own: 5,
};

/** "GroupRead" -> "read", "GroupFull" -> "full", "read_only" -> "read only". */
function policyAction(policy: string): string {
  return policy
    .replace(/^[A-Z][a-z]+(?=[A-Z])/, '') // drop a leading resource-type prefix ("Group", "Dataset", …)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
}

/** Rank of a resource policy by its action, for "who has more" comparisons. Unknown actions rank 0. */
export function policyRank(policy: string | null): number {
  if (!policy) return 0;
  return POLICY_RANK[policyAction(policy).split(' ')[0]] ?? 0;
}

/** "GroupRead" -> "Read", "GroupFull" -> "Full", "read_only" -> "Read Only". Falls back to the raw string. */
export function formatPolicy(policy: string): string {
  const action = policyAction(policy);
  if (!action) return policy;
  return action
    .split(' ')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

/** Display label for the kind of group a `gid` points at ("Worker Group", "Fleet", …). */
export function groupKindLabel(product: Product | undefined): string {
  return (product && GROUP_KIND_LABELS[product]) || 'Group';
}

/** Singular display label for an RBAC resource type. */
export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  groups: 'Group',
  datasets: 'Dataset',
  'dataset-providers': 'Dataset Provider',
  projects: 'Project',
  dashboards: 'Dashboard',
  macros: 'Macro',
  notebooks: 'Notebook',
  'notebook-templates': 'Notebook Template',
  apps: 'App',
};

/** "datasets" + "ds-1" -> "Dataset · ds-1". */
export function resourceLabel(type: string, id: string | undefined): string {
  return `${RESOURCE_TYPE_LABELS[type] ?? type}${id ? ` · ${id}` : ''}`;
}

function strongerPolicy(current: string | null, next: string): string {
  if (current === null || current === next) return next;
  return policyRank(next) > policyRank(current) ? next : current;
}

function sourceKey(source: AccessSource): string {
  switch (source.kind) {
    case 'direct':
      return 'direct';
    case 'team':
      return `team:${source.teamId}`;
    case 'workspace':
      return `workspace:${source.workspaceId}`;
  }
}

/** Add a source to the list unless an equivalent one is already there. */
function addSource(sources: AccessSource[], next: AccessSource): void {
  const key = sourceKey(next);
  if (!sources.some((s) => sourceKey(s) === key)) sources.push(next);
}

function mergeGrant(current: GroupGrant | null, policy: string, via: AccessSource): GroupGrant {
  if (!current) return { policy, sources: [via] };
  const sources = [...current.sources];
  addSource(sources, via);
  return { policy: strongerPolicy(current.policy, policy), sources };
}

interface AclSource {
  /** Owning product, when the entries came from a per-product ACL. */
  product?: Product;
  entries: ResourcePolicy[];
  /** Where these entries were granted. Defaults to a direct assignment. */
  via?: AccessSource;
}

/**
 * Collapse the raw per-source `ResourcePolicy[]` lists into one row per group.
 * Group-level access (`type: 'groups'`) becomes `groupPolicy`; everything else
 * becomes a `resourcePolicies` entry. When the same group or resource is granted
 * from several sources (assigned directly *and* via one or more Teams), the
 * strongest policy wins and every source is recorded. Rows — and the resources
 * within them — are sorted strongest-access first.
 */
export function summarizeGroupAccess(sources: AclSource[]): GroupAccess[] {
  const byGid = new Map<string, GroupAccess>();

  const DIRECT: AccessSource = { kind: 'direct' };
  for (const { product, entries, via = DIRECT } of sources) {
    for (const entry of entries) {
      let acc = byGid.get(entry.gid);
      if (!acc) {
        acc = { gid: entry.gid, product, groupPolicy: null, resourcePolicies: [] };
        byGid.set(entry.gid, acc);
      }
      if (product && !acc.product) acc.product = product;

      if (entry.type === 'groups') {
        acc.groupPolicy = mergeGrant(acc.groupPolicy, entry.policy, via);
      } else {
        const existing = acc.resourcePolicies.find((r) => r.type === entry.type && r.id === entry.id);
        if (existing) {
          existing.policy = strongerPolicy(existing.policy, entry.policy);
          addSource(existing.sources, via);
        } else {
          acc.resourcePolicies.push({ type: entry.type, id: entry.id, policy: entry.policy, sources: [via] });
        }
      }
    }
  }

  for (const acc of byGid.values()) {
    acc.resourcePolicies.sort(
      (a, b) =>
        policyRank(b.policy) - policyRank(a.policy) ||
        a.type.localeCompare(b.type) ||
        (a.id ?? '').localeCompare(b.id ?? ''),
    );
  }

  return [...byGid.values()].sort(
    (a, b) =>
      policyRank(b.groupPolicy?.policy ?? null) - policyRank(a.groupPolicy?.policy ?? null) ||
      a.gid.localeCompare(b.gid),
  );
}

// --- Reverse lookup: who can access a Worker Group / Fleet --------------------

function userName(user: User): string {
  return [user.first, user.last].filter(Boolean).join(' ') || user.username || user.id;
}

/** The group-level policy on this gid, or the strongest resource-level one so the principal still surfaces. */
function pickGroupPolicy(perms: ResourcePolicy[], gid: string): string | null {
  const scoped = perms.filter((p) => p.gid === gid);
  const groupEntry = scoped.find((p) => p.type === 'groups');
  if (groupEntry) return groupEntry.policy;
  return scoped.map((p) => p.policy).sort((a, b) => policyRank(b) - policyRank(a))[0] ?? null;
}

export interface GroupUserReach {
  user: User;
  /** Group-level policy, or null when the principal only has resource-level grants inside the group. */
  policy: string | null;
  sources: AccessSource[];
}

export interface GroupTeamReach {
  team: Team;
  policy: string | null;
  members: User[];
}

export interface GroupReach {
  users: GroupUserReach[];
  teams: GroupTeamReach[];
  /** ACL principal strings that didn't match any known user/team. */
  unresolved: string[];
}

interface GroupReachInput {
  acl: GroupAclResult;
  gid: string;
  users: User[];
  teams: Team[];
  userById: Map<string, User>;
  teamById: Map<string, Team>;
  resolveTeamAccess: (team: Team) => TeamAccess;
}

/**
 * Resolve a Worker Group's ACL into "who can reach it": every user with a direct
 * grant, plus the members of every team with a grant, merged (strongest policy
 * wins, all origins recorded), and the list of teams themselves.
 */
export function resolveGroupReach({
  acl,
  gid,
  users,
  teams,
  userById,
  teamById,
  resolveTeamAccess,
}: GroupReachInput): GroupReach {
  const unresolved: string[] = [];
  const findUser = (p: string) =>
    userById.get(p) ?? users.find((u) => u.username === p || u.email === p);
  const findTeam = (p: string) => teamById.get(p) ?? teams.find((t) => t.name === p);

  const byUserId = new Map<string, GroupUserReach>();
  const addUser = (user: User, policy: string | null, source: AccessSource) => {
    const existing = byUserId.get(user.id);
    if (existing) {
      if (policyRank(policy) > policyRank(existing.policy)) existing.policy = policy;
      addSource(existing.sources, source);
    } else {
      byUserId.set(user.id, { user, policy, sources: [source] });
    }
  };

  for (const entry of acl.users) {
    const user = findUser(entry.principal);
    if (!user) {
      unresolved.push(entry.principal);
      continue;
    }
    addUser(user, pickGroupPolicy(entry.perms, gid), { kind: 'direct' });
  }

  const teamReach: GroupTeamReach[] = [];
  for (const entry of acl.teams) {
    const team = findTeam(entry.principal);
    if (!team) {
      unresolved.push(entry.principal);
      continue;
    }
    const policy = pickGroupPolicy(entry.perms, gid);
    const members = resolveTeamAccess(team).members;
    teamReach.push({ team, policy, members });
    for (const member of members) {
      addUser(member, policy, { kind: 'team', teamId: team.id, teamName: team.name });
    }
  }

  const userReach = [...byUserId.values()].sort(
    (a, b) =>
      policyRank(b.policy) - policyRank(a.policy) || userName(a.user).localeCompare(userName(b.user)),
  );
  teamReach.sort(
    (a, b) => policyRank(b.policy) - policyRank(a.policy) || a.team.name.localeCompare(b.team.name),
  );

  return { users: userReach, teams: teamReach, unresolved: [...new Set(unresolved)] };
}
