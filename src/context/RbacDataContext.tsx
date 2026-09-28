import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchAllGroups,
  fetchAllRoles,
  fetchAllTeamMemberships,
  fetchAllTeams,
  fetchAllUsers,
  type TeamMembership,
} from '../api/rbac';
import { clearUserAclCache } from '../hooks/useUserAcl';
import { clearTeamAclCache } from '../hooks/useTeamAcl';
import { clearGroupAclCache } from '../hooks/useGroupAcl';
import type { ConfigGroup, Role, RoleSource, Team, TeamAccess, User, UserAccess } from '../api/types';

interface RbacContextValue {
  loading: boolean;
  /** True while a manual refresh is in flight (data stays visible, unlike the first load). */
  refreshing: boolean;
  error: string | null;
  users: User[];
  teams: Team[];
  roles: Role[];
  groups: ConfigGroup[];
  userById: Map<string, User>;
  teamById: Map<string, Team>;
  roleById: Map<string, Role>;
  groupById: Map<string, ConfigGroup>;
  resolveUserAccess: (user: User) => UserAccess;
  resolveTeamAccess: (team: Team) => TeamAccess;
  /** Re-fetch every RBAC collection and clear the per-user/per-team ACL caches. */
  reload: () => void;
}

const RbacDataContext = createContext<RbacContextValue | null>(null);

export function RbacDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<ConfigGroup[]>([]);
  const [teamMemberships, setTeamMemberships] = useState<Map<string, TeamMembership>>(new Map());
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const [usersResult, teamsResult, rolesResult, groupsResult] = await Promise.all([
          fetchAllUsers(),
          fetchAllTeams(),
          fetchAllRoles(),
          fetchAllGroups(),
        ]);
        if (cancelled) return;
        setUsers(usersResult);
        setTeams(teamsResult);
        setRoles(rolesResult);
        setGroups(groupsResult);

        // Depends on the team list, so it's fetched as a second stage.
        const membershipResult = await fetchAllTeamMemberships(teamsResult);
        if (cancelled) return;
        setTeamMemberships(membershipResult);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load RBAC data.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => {
    clearUserAclCache();
    clearTeamAclCache();
    clearGroupAclCache();
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }, []);

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const value = useMemo<RbacContextValue>(() => {
    const userKeys = (user: User): string[] =>
      [user.id, user.username, user.email]
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim().toLowerCase());

    const isTeamMember = (team: Team, user: User): boolean => {
      if ((user.teams ?? []).includes(team.id)) return true;
      const membership = teamMemberships.get(team.id);
      if (!membership || membership.keys.length === 0) return false;
      const keys = userKeys(user);
      return membership.keys.some((m) => keys.includes(m));
    };

    const resolveUserAccess = (user: User): UserAccess => {
      const userTeams = teams.filter((team) => isTeamMember(team, user));
      const workspaceEntries = Object.values(user.workspaceRoles ?? {});

      const sourcesByRoleId = new Map<string, RoleSource[]>();
      const addSource = (roleId: string, source: RoleSource) => {
        sourcesByRoleId.set(roleId, [...(sourcesByRoleId.get(roleId) ?? []), source]);
      };

      // `user.roles` from the API is the *resolved* set — it already contains
      // roles inherited from Teams / Workspace roles. So a role only counts as
      // "directly assigned" when no Team or Workspace membership explains it.
      const inheritedRoleIds = new Set([
        ...userTeams.flatMap((team) => team.roles),
        ...workspaceEntries.flatMap((entry) => entry.roles),
      ]);
      for (const roleId of user.roles ?? []) {
        if (!inheritedRoleIds.has(roleId)) addSource(roleId, { kind: 'direct' });
      }
      for (const team of userTeams) {
        for (const roleId of team.roles) addSource(roleId, { kind: 'team', team });
      }
      // Cloud-only: roles granted at the Workspace level, independent of Team membership.
      for (const { workspaceId, roles: workspaceRoleIds } of workspaceEntries) {
        for (const roleId of workspaceRoleIds) addSource(roleId, { kind: 'workspace', workspaceId });
      }

      const effectiveRoles = [...sourcesByRoleId.entries()]
        .map(([roleId, sources]) => {
          const role = roleById.get(roleId);
          return role ? { role, sources } : null;
        })
        .filter((r): r is { role: Role; sources: RoleSource[] } => r !== null);

      return { teams: userTeams, effectiveRoles };
    };

    const resolveTeamAccess = (team: Team): TeamAccess => {
      const roles = team.roles.map((id) => roleById.get(id)).filter((r): r is Role => r !== undefined);
      const members = users.filter((user) => isTeamMember(team, user));
      const membership = teamMemberships.get(team.id);

      // Identifiers the team source listed that no roster account matched.
      const matched = new Set(members.flatMap(userKeys));
      const unresolvedMembers = (membership?.keys ?? []).filter((m) => !matched.has(m));

      return {
        roles,
        members,
        unresolvedMembers,
        membershipListComplete: membership?.endpointOk ?? false,
      };
    };

    return {
      loading,
      refreshing,
      error,
      users,
      teams,
      roles,
      groups,
      userById,
      teamById,
      roleById,
      groupById,
      resolveUserAccess,
      resolveTeamAccess,
      reload,
    };
  }, [
    loading,
    refreshing,
    error,
    users,
    teams,
    roles,
    groups,
    userById,
    teamById,
    roleById,
    groupById,
    teamMemberships,
    reload,
  ]);

  return <RbacDataContext.Provider value={value}>{children}</RbacDataContext.Provider>;
}

export function useRbacData(): RbacContextValue {
  const ctx = useContext(RbacDataContext);
  if (!ctx) throw new Error('useRbacData must be used within RbacDataProvider');
  return ctx;
}
