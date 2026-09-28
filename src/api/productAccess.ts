import { PRODUCTS, type EffectiveRole, type Product, type User } from './types';
import { isOrgAdmin as computeOrgAdmin } from './access';

/**
 * Cribl's built-in per-product roles are named "{product}_{level}" (or a close
 * variant) — e.g. "stream_editor". Levels are derived from the resolved role ids
 * at runtime rather than a hardcoded list, so this holds up regardless of the
 * exact naming convention an org's roles use.
 */
export const LEVEL_RANK: Record<string, number> = {
  'no access': 0,
  user: 1,
  'read only': 2,
  editor: 3,
  admin: 4,
};

/** Short, one-line gloss for each standard access level. Unknown levels get none. */
const LEVEL_DESCRIPTIONS: Record<string, string> = {
  'no access': 'Cannot access this product',
  user: 'Standard user access — run jobs and view data',
  'read only': 'View-only access to configuration and data',
  editor: 'View and edit configuration',
  admin: 'Full control over the product and its settings',
};

export function levelDescription(level: string): string | undefined {
  return LEVEL_DESCRIPTIONS[level.toLowerCase()];
}

/** Rank of an access level for "who has more" comparisons. Unknown levels rank -1. */
export function levelRank(level: string): number {
  return LEVEL_RANK[level.toLowerCase()] ?? -1;
}

export function humanize(raw: string): string {
  const spaced = raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return spaced
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function matchProductLevel(roleId: string, product: Product): string | null {
  const match = roleId.match(new RegExp(`^${product}[-_]?(.+)$`, 'i'));
  if (!match?.[1]) return null;
  return humanize(match[1]);
}

/** The level a single `{product}_{level}` role grants on `product` (e.g. `stream_editor` → "Editor"), or null. */
export function roleProductLevel(roleId: string, product: Product): string | null {
  return matchProductLevel(roleId, product);
}

function bestLevel(levels: string[]): string {
  if (levels.length === 0) return 'No Access';
  const unique = [...new Set(levels)];
  if (unique.length === 1) return unique[0];
  return [...unique].sort((a, b) => levelRank(b) - levelRank(a))[0];
}

export type ProductAccessKey = 'workspace' | Product;

/** Rows shown by the product-access view / comparison, in order. */
export const PRODUCT_ACCESS_KEYS: ProductAccessKey[] = ['workspace', ...PRODUCTS];

export interface ProductAccess {
  isOrgAdmin: boolean;
  /**
   * Effective level per scope. `workspace` is `null` when the user has no
   * Workspace-scoped role and isn't an org admin; every product is always a
   * string ("No Access" at minimum).
   */
  levels: Record<ProductAccessKey, string | null>;
}

/**
 * A user's effective access level for the Workspace and each product, derived
 * from their resolved role set. `admin` at the org level (Cribl's built-in
 * `admin` / `owner` role) means Admin everywhere, regardless of any per-product
 * role. Single source of truth for both `ProductAccessSummary` and the compare
 * view.
 */
export function computeProductAccess(user: User, effectiveRoles: EffectiveRole[]): ProductAccess {
  const allRoleIds = effectiveRoles.map((r) => r.role.id);
  const isOrgAdmin = computeOrgAdmin(allRoleIds);

  const workspaceRoleIds = Object.values(user.workspaceRoles ?? {}).flatMap((entry) => entry.roles);
  const workspaceOnlyIds = workspaceRoleIds.filter(
    (id) => !PRODUCTS.some((p) => matchProductLevel(id, p) !== null),
  );

  const levels = {} as Record<ProductAccessKey, string | null>;
  levels.workspace = isOrgAdmin
    ? 'Admin'
    : workspaceOnlyIds.length > 0
      ? [...new Set(workspaceOnlyIds.map(humanize))].join(', ')
      : null;

  for (const product of PRODUCTS) {
    levels[product] = isOrgAdmin
      ? 'Admin'
      : bestLevel(
          allRoleIds
            .map((id) => matchProductLevel(id, product))
            .filter((m): m is string => m !== null),
        );
  }

  return { isOrgAdmin, levels };
}
