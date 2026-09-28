import { useEffect, useState } from 'react';
import { fetchGroupAcl } from '../api/rbac';
import type { CoreProduct, GroupAclResult } from '../api/types';

// Module-level cache: mirrors useUserAcl / useTeamAcl.
const cache = new Map<string, Promise<GroupAclResult>>();

/** Drop every cached group ACL so the next lookup re-fetches. Called on a manual data refresh. */
export function clearGroupAclCache(): void {
  cache.clear();
}

function getCached(product: CoreProduct, groupId: string): Promise<GroupAclResult> {
  const key = `${product}:${groupId}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = fetchGroupAcl(product, groupId);
    cache.set(key, pending);
  }
  return pending;
}

/** Lazily fetches (and caches) the reverse-lookup ACL for a Worker Group the first time it's opened. */
export function useGroupAcl(
  product: CoreProduct | undefined,
  groupId: string | undefined,
): { data: GroupAclResult | null; loading: boolean } {
  const [data, setData] = useState<GroupAclResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!product || !groupId) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setData(null);
    getCached(product, groupId).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [product, groupId]);

  return { data, loading };
}
