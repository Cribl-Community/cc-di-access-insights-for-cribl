/**
 * Access Check "two-person map": every admin reach, team, role, and Worker
 * Group / resource grant of two users, placed in one of three lanes — only A,
 * shared, only B — with the source(s) each side gets it from. Built from the
 * users' resolved roles, admin reach, and per-source grants (`groupsBySource`,
 * i.e. the existing `summarizeGroupAccess` run per source). Nothing here
 * decides access.
 */
import {
  PRODUCT_LABELS,
  type ConfigGroup,
  type GroupAccess,
  type Product,
  type RoleSource,
  type UserAccess,
} from '../api/types';
import { productForRoleId, type GroupAdminReach } from '../api/access';
import { formatPolicy, groupKindLabel, resourceLabel } from '../api/acl';
import { levelBucket, type LevelBucket } from './levels';

export type Lane = 'a' | 'both' | 'b';
export type MapCategory = 'reach' | 'teams' | 'roles' | 'grants';

export const MAP_CATEGORIES: Array<{ key: MapCategory; title: string }> = [
  { key: 'reach', title: 'Inherited admin reach' },
  { key: 'teams', title: 'Teams' },
  { key: 'roles', title: 'Roles' },
  { key: 'grants', title: 'Worker Groups & resources' },
];

export interface MapItem {
  id: string;
  category: MapCategory;
  kind: 'reach' | 'team' | 'role' | 'group' | 'resource';
  label: string;
  /** Where it sits (e.g. "in Prod Worker Group"), shown under the label. */
  context?: string;
  product?: Product;
  lane: Lane;
  levelA?: string;
  levelB?: string;
  /** How each side gets it: "Direct", "via Platform", … */
  viaA: string[];
  viaB: string[];
  link?: string;
  resourceType?: string;
}

export interface Side {
  access: UserAccess;
  bySource: Map<string, GroupAccess[]> | null;
  adminReach: GroupAdminReach[];
}

const BUCKET_RANK: Record<LevelBucket, number> = { none: 0, other: 1, user: 2, read: 3, editor: 4, admin: 5 };

const laneOf = (a: boolean, b: boolean): Lane => (a && b ? 'both' : a ? 'a' : 'b');

function via(s: RoleSource | { kind: string; teamId?: string; teamName?: string; workspaceId?: string }): string {
  if (s.kind === 'team') return `via ${'team' in s ? s.team.name : (s.teamName ?? s.teamId)}`;
  if (s.kind === 'workspace') return `Workspace ${(s as { workspaceId: string }).workspaceId}`;
  return 'Direct';
}

function viaKey(key: string, access: UserAccess): string {
  if (key === 'direct') return 'Direct';
  if (key.startsWith('team:')) {
    const id = key.slice(5);
    return `via ${access.teams.find((t) => t.id === id)?.name ?? id}`;
  }
  return `Workspace ${key.slice(3)}`;
}

type Grant = Omit<MapItem, 'lane' | 'levelA' | 'levelB' | 'viaA' | 'viaB'> & { level: string; via: string[] };

/** Per group / resource: the strongest level one side gets, and every source it comes through. */
function collectGrants(side: Side, groupById: Map<string, ConfigGroup>): Map<string, Grant> {
  const out = new Map<string, Grant>();
  const add = (key: string, base: Omit<Grant, 'level' | 'via'>, policy: string, source: string) => {
    const level = formatPolicy(policy);
    const cur = out.get(key);
    if (!cur) {
      out.set(key, { ...base, level, via: [source] });
      return;
    }
    if (!cur.via.includes(source)) cur.via.push(source);
    if (BUCKET_RANK[levelBucket(level)] > BUCKET_RANK[levelBucket(cur.level)]) cur.level = level;
  };
  for (const [key, list] of side.bySource ?? []) {
    const source = viaKey(key, side.access);
    for (const g of list) {
      const meta = groupById.get(g.gid);
      const product = g.product ?? meta?.product;
      const title = meta?.name ?? (g.gid === '*' ? 'All groups (*)' : g.gid);
      const link = meta ? `/worker-groups/${encodeURIComponent(g.gid)}` : undefined;
      if (g.groupPolicy) {
        add(
          `g:${g.gid}`,
          { id: `g:${g.gid}`, category: 'grants', kind: 'group', label: title, context: groupKindLabel(product), product, link },
          g.groupPolicy.policy,
          source,
        );
      }
      for (const r of g.resourcePolicies) {
        const id = `r:${g.gid}:${r.type}:${r.id ?? ''}`;
        add(
          id,
          {
            id,
            category: 'grants',
            kind: 'resource',
            label: resourceLabel(r.type, r.id),
            context: `in ${title}`,
            product,
            link,
            resourceType: r.type,
          },
          r.policy,
          source,
        );
      }
    }
  }
  return out;
}

function reachLabel(r: GroupAdminReach): string {
  const lvl = r.owner ? 'owner' : 'admin';
  if (r.scope === 'org') return `Organization ${lvl}`;
  if (r.scope === 'workspace') return `Workspace ${lvl}`;
  return `${PRODUCT_LABELS[r.product!]} admin`;
}

export function buildCompareMap(a: Side, b: Side, groupById: Map<string, ConfigGroup>): MapItem[] {
  const items: MapItem[] = [];

  // Inherited admin reach
  const reachA = new Map(a.adminReach.map((r) => [reachLabel(r), r]));
  const reachB = new Map(b.adminReach.map((r) => [reachLabel(r), r]));
  for (const label of new Set([...reachA.keys(), ...reachB.keys()])) {
    const ra = reachA.get(label);
    const rb = reachB.get(label);
    const r = (ra ?? rb)!;
    items.push({
      id: `reach:${label}`,
      category: 'reach',
      kind: 'reach',
      label,
      context: r.scope === 'product' ? `Admin on every ${PRODUCT_LABELS[r.product!]} group` : 'Admin everywhere below',
      product: r.scope === 'product' ? r.product : undefined,
      lane: laneOf(Boolean(ra), Boolean(rb)),
      viaA: ra ? ra.sources.map(via) : [],
      viaB: rb ? rb.sources.map(via) : [],
    });
  }

  // Teams
  for (const id of new Set([...a.access.teams.map((t) => t.id), ...b.access.teams.map((t) => t.id)])) {
    const ta = a.access.teams.find((t) => t.id === id);
    const tb = b.access.teams.find((t) => t.id === id);
    items.push({
      id: `team:${id}`,
      category: 'teams',
      kind: 'team',
      label: (ta ?? tb)!.name,
      lane: laneOf(Boolean(ta), Boolean(tb)),
      viaA: ta ? ['Member'] : [],
      viaB: tb ? ['Member'] : [],
      link: `/teams/${encodeURIComponent(id)}`,
    });
  }

  // Roles
  const rolesA = new Map(a.access.effectiveRoles.map((r) => [r.role.id, r]));
  const rolesB = new Map(b.access.effectiveRoles.map((r) => [r.role.id, r]));
  for (const id of new Set([...rolesA.keys(), ...rolesB.keys()])) {
    const ra = rolesA.get(id);
    const rb = rolesB.get(id);
    const title = (ra ?? rb)!.role.title || id;
    const product = productForRoleId(id);
    items.push({
      id: `role:${id}`,
      category: 'roles',
      kind: 'role',
      label: product && !title.toLowerCase().includes(product) ? `${title} · ${PRODUCT_LABELS[product]}` : title,
      context: id,
      product,
      lane: laneOf(Boolean(ra), Boolean(rb)),
      viaA: ra ? ra.sources.map(via) : [],
      viaB: rb ? rb.sources.map(via) : [],
    });
  }

  // Worker Group / resource grants
  const ga = collectGrants(a, groupById);
  const gb = collectGrants(b, groupById);
  for (const key of new Set([...ga.keys(), ...gb.keys()])) {
    const xa = ga.get(key);
    const xb = gb.get(key);
    const src = (xa ?? xb)!;
    items.push({
      id: src.id,
      category: src.category,
      kind: src.kind,
      label: src.label,
      context: src.context,
      product: src.product,
      link: src.link,
      resourceType: src.resourceType,
      lane: laneOf(Boolean(xa), Boolean(xb)),
      levelA: xa?.level,
      levelB: xb?.level,
      viaA: xa?.via ?? [],
      viaB: xb?.via ?? [],
    });
  }

  const catOrder = (c: MapCategory) => MAP_CATEGORIES.findIndex((x) => x.key === c);
  return items.sort(
    (x, y) =>
      catOrder(x.category) - catOrder(y.category) ||
      Number(x.kind === 'resource') - Number(y.kind === 'resource') ||
      x.label.localeCompare(y.label),
  );
}

/** A shared item whose level differs between the two users. */
export function levelDiffers(item: MapItem): boolean {
  return item.lane === 'both' && item.levelA !== undefined && item.levelB !== undefined && item.levelA !== item.levelB;
}
