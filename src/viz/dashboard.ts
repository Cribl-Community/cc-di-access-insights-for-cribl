/**
 * Dashboard view model — aggregates over the *existing* resolvers
 * (`resolveUserAccess`, `computeProductAccess`, `resolveGroupAdminReach`,
 * `computeOverviewStats`). Nothing here decides access; it only counts it.
 */
import { PRODUCTS, type Product, type Team, type User, type UserAccess } from '../api/types';
import { computeProductAccess, levelRank, type ProductAccess } from '../api/productAccess';
import { resolveGroupAdminReach, type GroupAdminReach } from '../api/access';
import { classifyAuth, type AuthKind } from '../api/overview';
import { levelBucket, type LevelBucket } from './levels';

export interface DashboardRow {
  user: User;
  name: string;
  access: UserAccess;
  product: ProductAccess;
  auth: AuthKind;
  /** Strongest level across products (org admin counts as Admin everywhere). */
  highest: { level: string; product: Product | null; rank: number };
  adminLabel: string | null;
}

export interface ProductStat {
  product: Product;
  total: number;
  withAccess: number;
  counts: Record<LevelBucket, number>;
}

export interface AttentionItem {
  key: 'disabled-with-access' | 'no-team' | 'empty-teams';
  label: string;
  count: number;
  to: string;
}

export interface DashboardModel {
  rows: DashboardRow[];
  products: ProductStat[];
  admins: DashboardRow[];
  attention: AttentionItem[];
  attentionTotal: number;
  ssoPct: number;
}

export function userName(user: User): string {
  return [user.first, user.last].filter(Boolean).join(' ') || user.username || user.id;
}

function adminLabel(reach: GroupAdminReach[]): string | null {
  const org = reach.find((g) => g.scope === 'org');
  if (org) return org.owner ? 'Organization owner' : 'Organization admin';
  const ws = reach.find((g) => g.scope === 'workspace');
  if (ws) return ws.owner ? 'Workspace owner' : 'Workspace admin';
  return null;
}

const EMPTY_COUNTS = (): Record<LevelBucket, number> => ({
  admin: 0,
  editor: 0,
  read: 0,
  user: 0,
  other: 0,
  none: 0,
});

export function buildDashboardModel(
  users: User[],
  teams: Team[],
  resolveUserAccess: (u: User) => UserAccess,
  teamIsEmpty: (t: Team) => boolean,
): DashboardModel {
  const people = users.filter((u) => classifyAuth(u) !== 'credential');

  const rows: DashboardRow[] = people.map((user) => {
    const access = resolveUserAccess(user);
    const product = computeProductAccess(user, access.effectiveRoles);
    let highest: DashboardRow['highest'] = { level: 'No Access', product: null, rank: 0 };
    for (const p of PRODUCTS) {
      const level = product.levels[p] ?? 'No Access';
      const rank = levelRank(level);
      if (rank > highest.rank) highest = { level, product: p, rank };
    }
    return {
      user,
      name: userName(user),
      access,
      product,
      auth: classifyAuth(user),
      highest,
      adminLabel: adminLabel(resolveGroupAdminReach(user, access.effectiveRoles)),
    };
  });

  const products: ProductStat[] = PRODUCTS.map((p) => {
    const counts = EMPTY_COUNTS();
    for (const r of rows) counts[levelBucket(r.product.levels[p])] += 1;
    return { product: p, total: rows.length, withAccess: rows.length - counts.none, counts };
  });

  const disabledWithAccess = rows.filter(
    (r) => r.user.disabled && (r.access.teams.length > 0 || r.access.effectiveRoles.length > 0),
  ).length;
  const noTeam = rows.filter((r) => r.access.teams.length === 0).length;
  const emptyTeams = teams.filter(teamIsEmpty).length;

  const attention: AttentionItem[] = [
    {
      key: 'disabled-with-access',
      label: 'Disabled but still holding roles',
      count: disabledWithAccess,
      to: `/query?q=${encodeURIComponent('disabled && (roles.length > 0 || teams.length > 0)')}`,
    },
    { key: 'no-team', label: 'Users in no team', count: noTeam, to: '/users?filter=no-team' },
    { key: 'empty-teams', label: 'Teams with no members', count: emptyTeams, to: '/teams?filter=empty' },
  ];

  const sso = rows.filter((r) => r.auth === 'saml' || r.auth === 'sso').length;

  return {
    rows,
    products,
    admins: rows.filter((r) => r.adminLabel),
    attention,
    attentionTotal: attention.reduce((n, a) => n + a.count, 0),
    ssoPct: rows.length ? Math.round((sso / rows.length) * 100) : 0,
  };
}
