import { useEffect, useState } from 'react';
import { fetchTeamAcl } from '../api/rbac';
import type { TeamAclResult } from '../api/types';

// Module-level cache: mirrors useUserAcl so reopening a Team doesn't refetch.
const cache = new Map<string, Promise<TeamAclResult>>();

/** Drop every cached team ACL so the next lookup re-fetches. Called on a manual data refresh. */
export function clearTeamAclCache(): void {
  cache.clear();
}

function getCached(teamId: string): Promise<TeamAclResult> {
  let pending = cache.get(teamId);
  if (!pending) {
    pending = fetchTeamAcl(teamId);
    cache.set(teamId, pending);
  }
  return pending;
}

/** Lazily fetches (and caches) a Team's resolved resource access the first time it's requested. */
export function useTeamAcl(teamId: string | undefined): { data: TeamAclResult | null; loading: boolean } {
  const [data, setData] = useState<TeamAclResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setData(null);
    getCached(teamId).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return { data, loading };
}

/** Fetches (and caches) several Teams' resource access at once — used to resolve a User's Team-inherited access. */
export function useTeamAcls(teamIds: string[]): { data: Map<string, TeamAclResult> | null; loading: boolean } {
  // Join into a primitive so the effect only reruns when the actual set changes.
  const key = [...teamIds].sort().join('\n');
  const [data, setData] = useState<Map<string, TeamAclResult> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ids = key ? key.split('\n') : [];
    if (ids.length === 0) {
      setData(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setData(null);
    Promise.all(ids.map((id) => getCached(id).then((result) => [id, result] as const))).then((pairs) => {
      if (cancelled) return;
      setData(new Map(pairs));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { data, loading };
}
