import { useEffect, useState } from 'react';
import { fetchUserAcl } from '../api/rbac';
import type { UserAclResult } from '../api/types';

// Module-level cache: an ACL lookup is 5 parallel requests, so once a user has
// been opened we don't want to redo that just because the component remounted.
const cache = new Map<string, Promise<UserAclResult>>();

/** Drop every cached user ACL so the next lookup re-fetches. Called on a manual data refresh. */
export function clearUserAclCache(): void {
  cache.clear();
}

function getCached(userId: string): Promise<UserAclResult> {
  let pending = cache.get(userId);
  if (!pending) {
    pending = fetchUserAcl(userId);
    cache.set(userId, pending);
  }
  return pending;
}

/** Lazily fetches (and caches) a user's resolved resource access the first time it's requested. */
export function useUserAcl(userId: string | undefined): { data: UserAclResult | null; loading: boolean } {
  const [data, setData] = useState<UserAclResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setData(null);
    getCached(userId).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { data, loading };
}
