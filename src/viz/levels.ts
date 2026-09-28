/**
 * Presentation-only mapping from an access-level string to a bucket on the
 * validated ordinal ramp (see theme.css `--lvl-*`). No access decisions here —
 * levels come from `computeProductAccess` / the ACL formatters unchanged.
 */

export type LevelBucket = 'admin' | 'editor' | 'read' | 'user' | 'other' | 'none';

/** Strongest first — the order legends and stacks are drawn in. */
export const LEVEL_BUCKETS: Array<{ key: LevelBucket; label: string; cssVar: string }> = [
  { key: 'admin', label: 'Admin', cssVar: 'var(--lvl-admin)' },
  { key: 'editor', label: 'Editor', cssVar: 'var(--lvl-editor)' },
  { key: 'read', label: 'Read Only', cssVar: 'var(--lvl-read)' },
  { key: 'user', label: 'User', cssVar: 'var(--lvl-user)' },
  { key: 'other', label: 'Other', cssVar: 'var(--lvl-other)' },
  { key: 'none', label: 'No Access', cssVar: 'var(--lvl-none)' },
];

export const LEVEL_BUCKET_BY_KEY = Object.fromEntries(LEVEL_BUCKETS.map((b) => [b.key, b])) as Record<
  LevelBucket,
  (typeof LEVEL_BUCKETS)[number]
>;

/**
 * Bucket for a product level ("Admin", "Read Only", …) or an ACL policy label
 * ("Full", "Maintainer", "Read", …). Levels outside the standard five (Collect, custom role suffixes) go to `other`.
 */
export function levelBucket(level: string | null | undefined): LevelBucket {
  const l = (level ?? '').trim().toLowerCase();
  if (!l || l === 'no access' || l === 'none' || l === '—') return 'none';
  if (l === 'admin' || l === 'owner' || l === 'full' || l === 'own' || l === 'maintainer' || l === 'maintain')
    return 'admin';
  if (l === 'editor' || l === 'edit' || l === 'write' || l === 'deploy') return 'editor';
  if (l === 'read only' || l === 'read' || l === 'readonly' || l === 'read-only') return 'read';
  if (l === 'user' || l === 'base') return 'user';
  return 'other';
}
