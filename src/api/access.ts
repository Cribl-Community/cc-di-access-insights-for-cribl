import {
  CORE_PRODUCTS,
  PRODUCTS,
  type AccessSource,
  type CoreProduct,
  type EffectiveRole,
  type Product,
  type RoleSource,
  type User,
} from './types';

/** Role ids (case-insensitive) that mean "full access at an object's level". `owner` outranks `admin` (it can also delete the object). */
const ADMIN_ROLE_IDS = ['owner', 'admin'];

function isAdminRoleId(roleId: string): boolean {
  return ADMIN_ROLE_IDS.includes(roleId.toLowerCase());
}

/** True when the resolved role set includes the org owner/admin role. */
export function isOrgAdmin(roleIds: string[]): boolean {
  return roleIds.some(isAdminRoleId);
}

/**
 * The product a role is scoped to, when its id follows Cribl's `<product>_<level>`
 * convention (e.g. `stream_admin` → 'stream'). Org-wide roles like `admin` return
 * undefined.
 */
export function productForRoleId(roleId: string): Product | undefined {
  const lower = roleId.toLowerCase();
  return PRODUCTS.find((p) => lower === p || lower.startsWith(`${p}_`) || lower.startsWith(`${p}-`));
}

function isProductAdminRoleId(roleId: string, product: CoreProduct): boolean {
  const lower = roleId.toLowerCase();
  return lower === `${product}_admin` || lower === `${product}-admin`;
}

/** Strip spaces / underscores / hyphens and lowercase — for matching role ids against display names. */
function normalizeRoleName(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Cribl.Cloud's "Workspace Admin" role — grants Admin on *every* product
 * (Stream, Edge, Search, Lake, …) within its Workspace, not just the core
 * Worker-Group products. Matched by id or display name so it's found whether the
 * API returns `workspace_admin` or a titled custom role.
 */
function isWorkspaceAdminRole(role: { id: string; title?: string; description?: string }): boolean {
  return [role.id, role.title, role.description].some(
    (v) => v !== undefined && normalizeRoleName(v) === 'workspaceadmin',
  );
}

function toAccessSources(sources: RoleSource[]): AccessSource[] {
  return sources.map((s): AccessSource => {
    switch (s.kind) {
      case 'team':
        return { kind: 'team', teamId: s.team.id, teamName: s.team.name };
      case 'workspace':
        return { kind: 'workspace', workspaceId: s.workspaceId };
      default:
        return { kind: 'direct' };
    }
  });
}

function dedupeSources(sources: AccessSource[]): AccessSource[] {
  const seen = new Set<string>();
  const out: AccessSource[] = [];
  for (const s of sources) {
    const key =
      s.kind === 'direct' ? 'direct' : s.kind === 'team' ? `team:${s.teamId}` : `ws:${s.workspaceId}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

/**
 * An admin role that grants implicit access to Worker Groups the ACL endpoints
 * don't report — because in Cribl's model, permission inherits downward:
 *   - `org`       → Admin on every Worker Group / Fleet, all products.
 *   - `workspace` → Admin on every Worker Group / Fleet in the listed Workspaces
 *                   (which, for this single-deployment app, is every group shown).
 *   - `product`   → Admin on every Worker Group / Fleet of that one product.
 */
export interface GroupAdminReach {
  scope: 'org' | 'workspace' | 'product';
  /** For `scope: 'org' | 'workspace'` — true when the role is Owner (not just Admin). */
  owner?: boolean;
  /** For `scope: 'product'` — the product whose groups are reached. */
  product?: CoreProduct;
  /** For `scope: 'workspace'` — the Workspace ids. */
  workspaceIds: string[];
  /** How the admin role was granted (direct / via Team / via a Workspace role). */
  sources: AccessSource[];
}

/**
 * Every implicit Worker-Group-admin grant a user holds, derived from their role
 * set (org admin, Workspace admin, or per-product admin — however granted:
 * directly, via a Team, or via a Workspace role). Empty when the user has no
 * admin role above the Worker Group level.
 */
export function resolveGroupAdminReach(
  user: User,
  effectiveRoles: EffectiveRole[],
): GroupAdminReach[] {
  const adminRoles = effectiveRoles.filter((r) => isAdminRoleId(r.role.id));
  const hasOwner = (roles: { role: { id: string } }[]) =>
    roles.some((r) => r.role.id.toLowerCase() === 'owner');

  const workspaceRoleIdsLower = new Set(
    Object.values(user.workspaceRoles ?? {}).flatMap((e) => e.roles.map((id) => id.toLowerCase())),
  );

  // Owner / Admin at the org level: an owner/admin role with a source that isn't
  // Workspace-scoped, or an owner/admin id in the raw role list that no Workspace
  // role explains (covers built-in roles not returned by /system/roles).
  const orgRole = adminRoles.find((r) => r.sources.some((s) => s.kind !== 'workspace'));
  const rawOrg = (user.roles ?? [])
    .map((id) => id.toLowerCase())
    .filter((id) => ADMIN_ROLE_IDS.includes(id) && !workspaceRoleIdsLower.has(id));
  if (orgRole || rawOrg.length > 0) {
    return [
      {
        scope: 'org',
        owner: hasOwner(adminRoles) || rawOrg.includes('owner'),
        workspaceIds: [],
        sources: orgRole ? toAccessSources(orgRole.sources) : [{ kind: 'direct' }],
      },
    ];
  }

  // Admin scoped to a Workspace: an owner/admin role with a Workspace source, a
  // `user.workspaceRoles` entry with an admin role, or Cribl's "Workspace Admin"
  // role (however granted — including via a Team). Any of these means Admin on
  // *every* product in that Workspace, so it collapses the per-product grants.
  const wsAdminRole = effectiveRoles.find((r) => isWorkspaceAdminRole(r.role));
  const workspaceRole = adminRoles.find((r) => r.sources.some((s) => s.kind === 'workspace'));
  const workspaceRolesFromMap = Object.values(user.workspaceRoles ?? {}).filter((e) =>
    e.roles.some(isAdminRoleId),
  );
  const workspaceIds = [
    ...new Set([
      ...adminRoles.flatMap((r) =>
        r.sources.flatMap((s) => (s.kind === 'workspace' ? [s.workspaceId] : [])),
      ),
      ...(wsAdminRole?.sources.flatMap((s) => (s.kind === 'workspace' ? [s.workspaceId] : [])) ?? []),
      ...workspaceRolesFromMap.map((e) => e.workspaceId),
    ]),
  ];
  if (wsAdminRole || workspaceRole || workspaceIds.length > 0) {
    const primary = workspaceRole ?? wsAdminRole;
    return [
      {
        scope: 'workspace',
        owner:
          hasOwner(adminRoles) ||
          workspaceRolesFromMap.some((e) => e.roles.some((id) => id.toLowerCase() === 'owner')),
        workspaceIds,
        sources: dedupeSources(
          primary ? toAccessSources(primary.sources) : [{ kind: 'direct' }],
        ),
      },
    ];
  }

  // Per-product admin — reaches every Worker Group / Fleet of that product.
  const grants: GroupAdminReach[] = [];
  for (const product of CORE_PRODUCTS) {
    const role = effectiveRoles.find((r) => isProductAdminRoleId(r.role.id, product));
    if (role) {
      grants.push({
        scope: 'product',
        product,
        workspaceIds: [],
        sources: toAccessSources(role.sources),
      });
    }
  }
  return grants;
}

/** Does a user's implicit admin reach a Worker Group belonging to `product`? */
export function reachesGroupOfProduct(
  reach: GroupAdminReach[],
  product: CoreProduct | undefined,
): boolean {
  return reach.some(
    (g) => g.scope === 'org' || g.scope === 'workspace' || (g.scope === 'product' && g.product === product),
  );
}
