import { useMemo } from 'react';
import { Tag, Text } from '@capra/core';
import type { User, UserAccess } from '../api/types';
import { summarizeGroupAccess } from '../api/acl';
import { resolveGroupAdminReach } from '../api/access';
import { describeAuth } from '../api/overview';
import { useRbacData } from '../context/RbacDataContext';
import { buildUserGraph, groupsBySource } from '../viz/accessGraph';
import { initials } from '../lib/initials';
import { AuthBadge } from './AuthBadge';
import { useUserAcl } from '../hooks/useUserAcl';
import { useTeamAcls } from '../hooks/useTeamAcl';
import { DetailSection } from './DetailSection';
import { EffectiveRolesTable } from './EffectiveRolesTable';
import { TagLink } from './TagLink';
import { ResourceAccess } from './ResourceAccess';
import { ProductAccessSummary } from './ProductAccessSummary';
import { LazyAccessGraph as AccessGraph } from './graph/LazyAccessGraph';
import { ProductLevelStrip } from './graph/ProductLevelStrip';
import { ViewToggle } from './graph/ViewToggle';
import { useDetailView } from './graph/useDetailView';
import './DetailPanel.css';

interface UserDetailProps {
  user: User;
  access: UserAccess;
}

export function UserDetail({ user, access }: UserDetailProps) {
  const { groupById } = useRbacData();
  // Details is the full picture; the graph is for tracing how access is granted.
  const [view, setView] = useDetailView('details');
  const { data: acl, loading: aclLoading } = useUserAcl(user.id);
  const teamIds = useMemo(() => access.teams.map((t) => t.id), [access.teams]);
  const { data: teamAcls, loading: teamAclsLoading } = useTeamAcls(teamIds);

  // Resource Access = the user's own ACL (direct grants) merged with the ACL of
  // every Team they belong to — e.g. a Team wired to a Worker Group gives its
  // members access to that group.
  const groupAccess = useMemo(() => {
    if (!acl || !teamAcls) return null;
    return summarizeGroupAccess([
      ...acl.byProduct.map((entry) => ({ product: entry.product, entries: entry.entries })),
      ...access.teams.flatMap((team) => {
        const teamAcl = teamAcls.get(team.id);
        return teamAcl && !teamAcl.unavailable
          ? [{ entries: teamAcl.entries, via: { kind: 'team' as const, teamId: team.id, teamName: team.name } }]
          : [];
      }),
    ]);
  }, [acl, teamAcls, access.teams]);

  const unavailableTeams = useMemo(
    () => access.teams.filter((t) => teamAcls?.get(t.id)?.unavailable).map((t) => t.name),
    [access.teams, teamAcls],
  );

  const adminReach = useMemo(
    () => resolveGroupAdminReach(user, access.effectiveRoles),
    [user, access.effectiveRoles],
  );

  const graph = useMemo(
    () =>
      buildUserGraph({
        user,
        access,
        groupsBySource: groupsBySource(acl, teamAcls, access.teams),
        adminReach,
        groupById,
      }),
    [user, access, acl, teamAcls, adminReach, groupById],
  );

  const name = [user.first, user.last].filter(Boolean).join(' ') || user.username;
  const auth = describeAuth(user);
  const resourceLoading = aclLoading || teamAclsLoading;

  return (
    <div className={view === 'graph' ? 'detail-panel detail-panel-fill' : 'detail-panel'}>
      <div className="detail-header-with-toggle">
        <header className="detail-header">
          <div className="detail-avatar" aria-hidden>
            {initials(name)}
          </div>
          <div className="detail-header-text">
            <div className="detail-header-title">
              <Text as="h1" variant="heading-md">
                {name}
              </Text>
              {user.disabled && (
                <Tag color="danger" size="sm">
                  Disabled
                </Tag>
              )}
              <AuthBadge user={user} />
            </div>
            <Text color="secondary">
              {[user.username, user.email].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ')}
            </Text>
            {auth.detail && (
              <Text color="secondary" variant="body-xs-normal">
                {auth.detail}
              </Text>
            )}
            {auth.idpGroups.length > 0 && (
              <Text color="secondary" variant="body-xs-normal">
                IdP group membership: {auth.idpGroups.join(', ')}
              </Text>
            )}
          </div>
        </header>
        <ViewToggle view={view} onChange={setView} first="details" />
      </div>

      {view === 'graph' ? (
        <>
          <ProductLevelStrip user={user} effectiveRoles={access.effectiveRoles} />
          <section className="detail-graph-card glass-card" aria-label="Access graph">
            <AccessGraph tree={graph} loading={resourceLoading} />
          </section>
        </>
      ) : (
        <>
          <DetailSection title="Product Access">
            <ProductAccessSummary user={user} effectiveRoles={access.effectiveRoles} />
          </DetailSection>

          <DetailSection title="Teams" count={access.teams.length}>
            {access.teams.length === 0 ? (
              <Text color="secondary">Not a member of any Team.</Text>
            ) : (
              <div className="chip-row">
                {access.teams.map((team) => (
                  <TagLink key={team.id} to={`/teams/${encodeURIComponent(team.id)}`}>
                    {team.name}
                  </TagLink>
                ))}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Effective Roles" count={access.effectiveRoles.length}>
            <EffectiveRolesTable roles={access.effectiveRoles} emptyText="No Roles resolved for this user." />
          </DetailSection>

          <DetailSection title="Resource Access">
            <ResourceAccess
              groups={groupAccess}
              loading={resourceLoading}
              unavailableProducts={acl?.unavailableProducts}
              unavailableTeams={unavailableTeams}
              adminReach={adminReach}
            />
          </DetailSection>
        </>
      )}
    </div>
  );
}
