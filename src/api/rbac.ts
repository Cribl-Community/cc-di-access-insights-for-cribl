import { criblGet, criblGetAllPages } from './cribl';
import {
  CORE_PRODUCTS,
  PRODUCTS,
  type ConfigGroup,
  type CoreProduct,
  type GroupAclResult,
  type Paginated,
  type Product,
  type ResourcePolicy,
  type Role,
  type Team,
  type TeamAclResult,
  type User,
  type UserAclEntry,
  type UserAclResult,
} from './types';

function unionArrays(a?: string[], b?: string[]): string[] | undefined {
  if (!a && !b) return undefined;
  return [...new Set([...(a ?? []), ...(b ?? [])])];
}

function mergeUser(a: User, b: User): User {
  return {
    ...a,
    ...b,
    roles: unionArrays(a.roles, b.roles),
    teams: unionArrays(a.teams, b.teams),
  };
}

/**
 * API Credentials (Cribl.Cloud machine-to-machine clients) are their own resource
 * — `/products/{product}/users` does not list them. Tolerant: not licensed / not
 * permitted / on-prem just yields none.
 */
export async function fetchApiCredentials(): Promise<User[]> {
  try {
    const creds = await criblGetAllPages<User>('/system/credentials');
    return creds
      .filter((cred) => !cred.system) // hide Cribl's own internal service accounts
      .map((cred) => ({ ...cred, type: 'credential' as const }));
  } catch {
    return [];
  }
}

/**
 * Cribl Cloud has no endpoint that lists all Users directly (`GET /system/users`
 * is on-prem only). The roster is built by merging the per-product member lists
 * (which conveniently carry each user's `teams[]`/`roles[]` inline) with the
 * API Credentials list.
 */
export async function fetchAllUsers(): Promise<User[]> {
  const [productResults, apiCredentials] = await Promise.all([
    Promise.allSettled(PRODUCTS.map((product) => criblGetAllPages<User>(`/products/${product}/users`))),
    fetchApiCredentials(),
  ]);

  const byId = new Map<string, User>();
  for (const result of productResults) {
    if (result.status !== 'fulfilled') continue;
    for (const user of result.value) {
      const existing = byId.get(user.id);
      byId.set(user.id, existing ? mergeUser(existing, user) : user);
    }
  }
  for (const cred of apiCredentials) {
    const existing = byId.get(cred.id);
    byId.set(cred.id, existing ? { ...mergeUser(existing, cred), type: 'credential' } : cred);
  }
  return [...byId.values()];
}

export function fetchAllTeams(): Promise<Team[]> {
  return criblGetAllPages<Team>('/system/teams');
}

/** Pull every string identifier out of an arbitrary membership entry (string, or object keyed however). */
function membershipKeys(ref: unknown): string[] {
  const take = (v: unknown): string[] =>
    typeof v === 'string' && v.trim().length > 0 ? [v.trim().toLowerCase()] : [];
  if (typeof ref === 'string') return take(ref);
  if (ref && typeof ref === 'object') {
    const o = ref as Record<string, unknown>;
    return [o.id, o.username, o.email, o.user, o.name, o.userId, o.userName].flatMap(take);
  }
  return [];
}

/** Member identifiers embedded directly on the Team object, if any deployment includes them. */
function embeddedMemberKeys(team: Team): string[] {
  const lists = [team.members, team.users, team.memberIds, team.userIds];
  return lists.flatMap((list) => (Array.isArray(list) ? list.flatMap(membershipKeys) : []));
}

export interface TeamMembership {
  /** Every candidate identifier for this team's members, lower-cased. */
  keys: string[];
  /** False when `/system/teams/{id}/users` errored — `keys` is then only what the Team object carried. */
  endpointOk: boolean;
}

/**
 * `User.teams[]` on the per-product user objects is not a reliable source of
 * membership in practice, so membership is also read from the Team side —
 * unioning the `/system/teams/{id}/users` endpoint with anything embedded on the
 * Team object itself. Identifiers vary (id / username / email, strings or
 * objects), so every candidate is kept, lower-cased, and matched loosely.
 * Tolerant per-team: an endpoint failure is recorded (not thrown) so the UI can
 * say the member list may be incomplete.
 */
export async function fetchAllTeamMemberships(teams: Team[]): Promise<Map<string, TeamMembership>> {
  const results = await Promise.allSettled(
    teams.map((team) =>
      criblGetAllPages<unknown>(`/system/teams/${encodeURIComponent(team.id)}/users`),
    ),
  );

  const byTeamId = new Map<string, TeamMembership>();
  results.forEach((result, i) => {
    const team = teams[i];
    const embedded = embeddedMemberKeys(team);
    if (result.status === 'fulfilled') {
      const fromEndpoint = result.value.flatMap(membershipKeys);
      byTeamId.set(team.id, {
        keys: [...new Set([...embedded, ...fromEndpoint])],
        endpointOk: true,
      });
    } else {
      console.warn(`[access-insights] could not read members for team "${team.id}"`, result.reason);
      byTeamId.set(team.id, { keys: [...new Set(embedded)], endpointOk: false });
    }
  });
  return byTeamId;
}

export function fetchAllRoles(): Promise<Role[]> {
  return criblGetAllPages<Role>('/system/roles');
}

/**
 * Worker Group / Fleet / Outpost Group names, merged across the products that
 * have them. Each group carries the `product` it was found under so ACL entries
 * (whose `gid` alone doesn't say which product) can be labelled correctly.
 */
export async function fetchAllGroups(): Promise<ConfigGroup[]> {
  const results = await Promise.allSettled(
    CORE_PRODUCTS.map(
      async (product) =>
        [product, await criblGetAllPages<ConfigGroup>(`/products/${product}/groups`)] as const,
    ),
  );
  const byId = new Map<string, ConfigGroup>();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const [product, list] = result.value;
    for (const group of list) byId.set(group.id, { ...group, product });
  }
  return [...byId.values()];
}

/**
 * A user's concretely resolved access per product. Tolerant of individual
 * product failures (not licensed, not permitted, etc.) — those are reported
 * as "unavailable" rather than failing the whole lookup.
 */
export async function fetchUserAcl(userId: string): Promise<UserAclResult> {
  const results = await Promise.allSettled(
    PRODUCTS.map((product) =>
      criblGet<Paginated<ResourcePolicy>>(`/products/${product}/users/${encodeURIComponent(userId)}/acl`),
    ),
  );

  const byProduct: UserAclEntry[] = [];
  const unavailableProducts: Product[] = [];
  results.forEach((result, index) => {
    const product = PRODUCTS[index];
    if (result.status === 'fulfilled') {
      if (result.value.items.length > 0) byProduct.push({ product, entries: result.value.items });
    } else {
      unavailableProducts.push(product);
    }
  });
  return { byProduct, unavailableProducts };
}

/**
 * A Team's concretely resolved resource access. Unlike the per-user ACL this is
 * a single request (`gid` values already span every product), so a failure —
 * not permitted, not licensed, etc. — is reported as `unavailable` rather than
 * thrown. The `id` path segment is the Team name, which is what `Team.id` holds.
 */
export async function fetchTeamAcl(teamId: string): Promise<TeamAclResult> {
  try {
    const res = await criblGet<Paginated<ResourcePolicy>>(
      `/system/teams/${encodeURIComponent(teamId)}/acl`,
    );
    return { entries: res.items, unavailable: false };
  } catch {
    return { entries: [], unavailable: true };
  }
}

/**
 * The reverse lookup for a single Worker Group / Fleet / Outpost Group: the users
 * and teams that hold permissions on it, from the group-centric ACL endpoints.
 * Tolerant per call — a missing users or teams list just contributes nothing.
 */
export async function fetchGroupAcl(product: CoreProduct, groupId: string): Promise<GroupAclResult> {
  const base = `/products/${product}/groups/${encodeURIComponent(groupId)}/acl`;
  const [usersRes, teamsRes] = await Promise.allSettled([
    criblGetAllPages<{ user: string; perms: ResourcePolicy[] }>(base),
    criblGetAllPages<{ team: string; perms: ResourcePolicy[] }>(`${base}/teams`),
  ]);
  return {
    users:
      usersRes.status === 'fulfilled'
        ? usersRes.value.map((i) => ({ principal: i.user, perms: i.perms }))
        : [],
    teams:
      teamsRes.status === 'fulfilled'
        ? teamsRes.value.map((i) => ({ principal: i.team, perms: i.perms }))
        : [],
    unavailable: usersRes.status !== 'fulfilled' && teamsRes.status !== 'fulfilled',
  };
}
