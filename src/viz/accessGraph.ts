/**
 * Access-graph view model. Turns a principal's *already-resolved* access —
 * `UserAccess` (teams + effective roles with sources), the summarized ACL
 * (`GroupAccess[]`), and the admin reach from `resolveGroupAdminReach` — into
 * a tree the graph renders. No access decisions are made here.
 *
 * Node ids are semantic paths (`src:team:platform/role:edge_editor/product:edge`),
 * so the same grant has the same id for any user. Access Check relies on that
 * to merge two users' trees into one diff graph.
 */
import {
  PRODUCT_LABELS,
  type ConfigGroup,
  type GroupAccess,
  type Product,
  type Role,
  type Team,
  type TeamAccess,
  type TeamAclResult,
  type User,
  type UserAccess,
  type UserAclResult,
} from '../api/types';
import { isOrgAdmin, productForRoleId, type GroupAdminReach } from '../api/access';
import { roleProductLevel } from '../api/productAccess';
import { formatPolicy, groupKindLabel, resourceLabel, summarizeGroupAccess } from '../api/acl';

export type GraphNodeKind =
  | 'user'
  | 'apikey'
  | 'team'
  | 'direct'
  | 'workspace'
  | 'role'
  | 'product'
  | 'org'
  | 'scope'
  | 'group'
  | 'resource'
  | 'members'
  | 'member';

export type EdgeKind = 'direct' | 'team' | 'workspace' | 'inherited' | 'membership';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  sublabel?: string;
  /** Access level shown on the node's pill ("Admin", "Full", "Read Only", …). */
  level?: string;
  /** Products this node concerns — drives the product icon and the product filter. */
  products?: Product[];
  /** Style of the edge coming *into* this node from its parent. */
  edge?: EdgeKind;
  /** In-app route to open this entity. */
  link?: string;
  /** Starts collapsed (large or low-level branches). */
  collapsed?: boolean;
  /** Resource type, for the icon. */
  resourceType?: string;
  children: GraphNode[];
}

const CORE = ['stream', 'edge', 'outpost'] as const satisfies readonly Product[];
const SEARCH_LAKE = ['search', 'lake'] as const satisfies readonly Product[];

function node(partial: Omit<GraphNode, 'children'> & { children?: GraphNode[] }): GraphNode {
  return { children: [], ...partial };
}

function nameOf(user: User): string {
  return [user.first, user.last].filter(Boolean).join(' ') || user.username || user.id;
}

/** The inherited chain under an org / Workspace / product admin grant (mirrors AdminAccessTree). */
function adminReachNode(parentId: string, reach: GroupAdminReach): GraphNode {
  const resources = (id: string, kinds: string, products: Product[]) =>
    node({ id: `${id}/resources`, kind: 'scope', label: 'All resources', sublabel: kinds, level: 'Maintainer', products, edge: 'inherited' });
  const streamEdge = (id: string) =>
    node({
      id: `${id}/stream-edge`,
      kind: 'scope',
      label: 'Cribl Stream & Edge',
      sublabel: 'all Worker Groups & Fleets',
      level: 'Admin',
      products: [...CORE],
      edge: 'inherited',
      children: [resources(`${id}/stream-edge`, 'Pipelines, Packs, Lookups…', [...CORE])],
    });
  const searchLake = (id: string) =>
    node({
      id: `${id}/search-lake`,
      kind: 'scope',
      label: 'Cribl Search & Lake',
      sublabel: 'all datasets',
      level: 'Admin',
      products: [...SEARCH_LAKE],
      edge: 'inherited',
      children: [resources(`${id}/search-lake`, 'Datasets, Dashboards, Notebooks…', [...SEARCH_LAKE])],
    });

  const level = reach.owner ? 'Owner' : 'Admin';
  if (reach.scope === 'org') {
    const id = `${parentId}/reach:org`;
    return node({
      id,
      kind: 'org',
      label: 'Organization',
      sublabel: 'inherited by every Workspace',
      level,
      edge: 'inherited',
      collapsed: true,
      children: [
        node({
          id: `${id}/workspaces`,
          kind: 'scope',
          label: 'All Workspaces',
          level: 'Admin',
          edge: 'inherited',
          children: [streamEdge(`${id}/workspaces`), searchLake(`${id}/workspaces`)],
        }),
      ],
    });
  }
  if (reach.scope === 'workspace') {
    const id = `${parentId}/reach:workspace`;
    const ws = reach.workspaceIds.length === 1 ? `Workspace ${reach.workspaceIds[0]}` : 'Workspaces';
    return node({
      id,
      kind: 'workspace',
      label: ws,
      sublabel: 'every product in the Workspace',
      level,
      edge: 'inherited',
      collapsed: true,
      children: [streamEdge(id), searchLake(id)],
    });
  }
  const p = reach.product!;
  const id = `${parentId}/reach:${p}`;
  return node({
    id,
    kind: 'scope',
    label: `All ${groupKindLabel(p)}s`,
    sublabel: `every ${PRODUCT_LABELS[p]} group`,
    level: 'Admin',
    products: [p],
    edge: 'inherited',
    collapsed: true,
    children: [resources(id, 'Pipelines, Packs, Lookups…', [p])],
  });
}

/** A role, with the product scope it grants as its child. */
function roleNode(parentId: string, role: Role, edge: EdgeKind): GraphNode {
  const id = `${parentId}/role:${role.id}`;
  const product = productForRoleId(role.id);
  const children: GraphNode[] = [];
  if (product) {
    const level = roleProductLevel(role.id, product) ?? 'Custom';
    children.push(
      node({
        id: `${id}/product:${product}`,
        kind: 'product',
        label: `Cribl ${PRODUCT_LABELS[product]}`,
        level,
        products: [product],
        edge,
      }),
    );
  }
  // A role titled just by its level ("Admin") says nothing on its own — name the product too.
  const title = role.title || role.id;
  const label =
    product && title.trim().toLowerCase() === (roleProductLevel(role.id, product) ?? '').toLowerCase()
      ? `${title} · ${PRODUCT_LABELS[product]}`
      : title;
  return node({
    id,
    kind: 'role',
    label,
    sublabel: product ? role.id : isOrgAdmin([role.id]) ? `${role.id} · every product` : role.id,
    level: product ? undefined : isOrgAdmin([role.id]) ? (role.id.toLowerCase() === 'owner' ? 'Owner' : 'Admin') : undefined,
    products: product ? [product] : undefined,
    edge,
    children,
  });
}

/** A Worker Group / Fleet grant (and the resource grants inside it) reached through one source. */
function groupNode(
  parentId: string,
  g: GroupAccess,
  sourceKey: string,
  edge: EdgeKind,
  groupById: Map<string, ConfigGroup>,
): GraphNode | null {
  const matches = (sources: { kind: string; teamId?: string; workspaceId?: string }[]) =>
    sources.some((s) => srcKey(s) === sourceKey);
  const groupGrant = g.groupPolicy && matches(g.groupPolicy.sources) ? g.groupPolicy : null;
  const resources = g.resourcePolicies.filter((r) => matches(r.sources));
  if (!groupGrant && resources.length === 0) return null;

  const meta = groupById.get(g.gid);
  const product = g.product ?? meta?.product;
  const id = `${parentId}/group:${g.gid}`;
  return node({
    id,
    kind: 'group',
    label: meta?.name ?? (g.gid === '*' ? 'All groups (*)' : g.gid),
    sublabel: groupGrant ? groupKindLabel(product) : `${groupKindLabel(product)} · resource grants only`,
    level: groupGrant ? formatPolicy(groupGrant.policy) : undefined,
    products: product ? [product] : undefined,
    edge,
    link: meta ? `/worker-groups/${encodeURIComponent(g.gid)}` : undefined,
    collapsed: resources.length > 4,
    children: resources.map((r) =>
      node({
        id: `${id}/res:${r.type}:${r.id ?? ''}`,
        kind: 'resource',
        label: resourceLabel(r.type, r.id),
        level: formatPolicy(r.policy),
        products: product ? [product] : undefined,
        resourceType: r.type,
        edge,
      }),
    ),
  });
}

function srcKey(s: { kind: string; teamId?: string; workspaceId?: string; team?: Team }): string {
  if (s.kind === 'team') return `team:${s.teamId ?? s.team?.id}`;
  if (s.kind === 'workspace') return `ws:${s.workspaceId}`;
  return 'direct';
}

/**
 * The grants each source gives on its own — the principal's own ACL under
 * `direct`, each Team's ACL under `team:<id>` — summarized with the existing
 * `summarizeGroupAccess`, one source at a time. (The merged, all-sources
 * summary is right for "what can they reach" but not for "what does *this*
 * Team grant", which is what a node under the Team must show.)
 */
export function groupsBySource(
  acl: UserAclResult | null,
  teamAcls: Map<string, TeamAclResult> | null,
  teams: Team[],
): Map<string, GroupAccess[]> | null {
  if (!acl || !teamAcls) return null;
  const out = new Map<string, GroupAccess[]>();
  out.set('direct', summarizeGroupAccess(acl.byProduct.map((e) => ({ product: e.product, entries: e.entries }))));
  for (const t of teams) {
    const ta = teamAcls.get(t.id);
    if (!ta || ta.unavailable) continue;
    out.set(
      `team:${t.id}`,
      summarizeGroupAccess([{ entries: ta.entries, via: { kind: 'team', teamId: t.id, teamName: t.name } }]),
    );
  }
  return out;
}

interface UserGraphInput {
  user: User;
  access: UserAccess;
  /** Per-source grants from `groupsBySource`; null while the ACLs load. */
  groupsBySource: Map<string, GroupAccess[]> | null;
  adminReach: GroupAdminReach[];
  groupById: Map<string, ConfigGroup>;
}

/**
 * User / API key → Sources (Direct, each Team, each Workspace role) → Roles →
 * Products, plus Worker Group / resource grants under the source that granted
 * them, plus the inherited admin chain under the source of an admin role.
 */
export function buildUserGraph({ user, access, groupsBySource: bySource, adminReach, groupById }: UserGraphInput): GraphNode {
  const isKey = user.type === 'credential' || user.id.endsWith('@clients');
  const root = node({
    id: 'root',
    kind: isKey ? 'apikey' : 'user',
    label: nameOf(user),
    sublabel: isKey ? 'API key' : user.email || user.username,
  });

  // One node per source, created on demand, in a stable order: Direct, Teams, Workspaces.
  const sources = new Map<string, GraphNode>();
  const sourceNode = (key: string): GraphNode => {
    let s = sources.get(key);
    if (s) return s;
    if (key === 'direct') {
      s = node({ id: 'src:direct', kind: 'direct', label: 'Direct', sublabel: 'assigned to this account', edge: 'direct' });
    } else if (key.startsWith('team:')) {
      const teamId = key.slice(5);
      const team = access.teams.find((t) => t.id === teamId);
      s = node({
        id: `src:${key}`,
        kind: 'team',
        label: team?.name ?? teamId,
        sublabel: 'Team membership',
        edge: 'team',
        link: `/teams/${encodeURIComponent(teamId)}`,
      });
    } else {
      s = node({ id: `src:${key}`, kind: 'workspace', label: `Workspace ${key.slice(3)}`, sublabel: 'Workspace role', edge: 'workspace' });
    }
    sources.set(key, s);
    return s;
  };
  const edgeFor = (key: string): EdgeKind => (key === 'direct' ? 'direct' : key.startsWith('team:') ? 'team' : 'workspace');

  // Every Team shows, even one that grants nothing — membership is itself useful.
  for (const t of access.teams) sourceNode(`team:${t.id}`);

  for (const er of access.effectiveRoles) {
    for (const s of er.sources) {
      const key = srcKey(s);
      const parent = sourceNode(key);
      if (!parent.children.some((c) => c.id === `${parent.id}/role:${er.role.id}`)) {
        parent.children.push(roleNode(parent.id, er.role, edgeFor(key)));
      }
    }
  }

  for (const reach of adminReach) {
    for (const s of reach.sources) {
      const key = srcKey(s);
      const parent = sourceNode(key);
      parent.children.push(adminReachNode(parent.id, reach));
    }
  }

  for (const [key, list] of bySource ?? []) {
    for (const g of list) {
      const parent = sourceNode(key);
      const gn = groupNode(parent.id, g, key, edgeFor(key), groupById);
      if (gn) parent.children.push(gn);
    }
  }

  const order = (k: string) => (k === 'direct' ? 0 : k.startsWith('team:') ? 1 : 2);
  root.children = [...sources.entries()]
    .sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))
    .map(([, n]) => n);
  return root;
}

interface TeamGraphInput {
  team: Team;
  access: TeamAccess;
  groups: GroupAccess[] | null;
  groupById: Map<string, ConfigGroup>;
}

const MAX_MEMBERS = 40;

/** Team → Roles → Products, Worker Group / resource grants, and Members (collapsed). */
export function buildTeamGraph({ team, access, groups, groupById }: TeamGraphInput): GraphNode {
  const root = node({ id: 'root', kind: 'team', label: team.name, sublabel: 'Team' });
  for (const role of access.roles) root.children.push(roleNode('root', role, 'team'));
  for (const g of groups ?? []) {
    const gn = groupNode('root', g, 'direct', 'team', groupById);
    if (gn) root.children.push(gn);
  }
  const memberCount = access.members.length + access.unresolvedMembers.length;
  if (memberCount > 0) {
    const members = access.members.slice(0, MAX_MEMBERS).map((m) =>
      node({
        id: `root/members/user:${m.id}`,
        kind: 'member',
        label: nameOf(m),
        sublabel: m.disabled ? 'Disabled' : m.email || m.username,
        edge: 'membership',
        link: `/users/${encodeURIComponent(m.id)}`,
      }),
    );
    const overflow = memberCount - members.length;
    if (overflow > 0) {
      members.push(node({ id: 'root/members/more', kind: 'member', label: `+${overflow} more`, sublabel: 'see Details', edge: 'membership' }));
    }
    root.children.push(
      node({
        id: 'root/members',
        kind: 'members',
        label: 'Members',
        sublabel: `${memberCount} member${memberCount === 1 ? '' : 's'} inherit everything above`,
        edge: 'membership',
        collapsed: true,
        children: members,
      }),
    );
  }
  return root;
}

/** Every product a subtree touches (for filtering). */
export function subtreeProducts(n: GraphNode): Set<Product> {
  const out = new Set<Product>(n.products ?? []);
  for (const c of n.children) for (const p of subtreeProducts(c)) out.add(p);
  return out;
}

