import { useMemo } from 'react';
import { Alert, Tag, Text } from '@capra/core';
import { GroupOutlined } from '@capra/icons';
import { PRODUCT_LABELS, type Team, type TeamAccess } from '../api/types';
import { summarizeGroupAccess } from '../api/acl';
import { productForRoleId } from '../api/access';
import { isIdpMappedTeam } from '../api/overview';
import { useTeamAcl } from '../hooks/useTeamAcl';
import { DetailSection } from './DetailSection';
import { TagLink } from './TagLink';
import { ResourceAccess } from './ResourceAccess';
import { TeamIdpMapping } from './TeamIdpMapping';
import { useRbacData } from '../context/RbacDataContext';
import { buildTeamGraph } from '../viz/accessGraph';
import { LazyAccessGraph as AccessGraph } from './graph/LazyAccessGraph';
import { ViewToggle } from './graph/ViewToggle';
import { useDetailView } from './graph/useDetailView';
import './DetailPanel.css';

interface TeamDetailProps {
  team: Team;
  access: TeamAccess;
}

export function TeamDetail({ team, access }: TeamDetailProps) {
  const { data: acl, loading: aclLoading } = useTeamAcl(team.id);
  const groupAccess = useMemo(
    () => (acl ? summarizeGroupAccess([{ entries: acl.entries }]) : null),
    [acl],
  );
  const { groupById } = useRbacData();
  // Details is the full picture; the graph is for tracing how access is granted.
  const [view, setView] = useDetailView('details');
  const graph = useMemo(
    () => buildTeamGraph({ team, access, groups: groupAccess, groupById }),
    [team, access, groupAccess, groupById],
  );

  return (
    <div className={view === 'graph' ? 'detail-panel detail-panel-fill' : 'detail-panel'}>
      <div className="detail-header-with-toggle">
      <header className="detail-header">
        <div className="detail-avatar detail-avatar-team" aria-hidden>
          <GroupOutlined />
        </div>
        <div className="detail-header-text">
          <div className="detail-header-title">
            <Text as="h1" variant="heading-md">
              {team.name}
            </Text>
            {isIdpMappedTeam(team) && (
              <Tag color="info" size="sm">
                IdP-mapped
              </Tag>
            )}
            <Text color="secondary" variant="body-sm-normal">
              {team.id}
            </Text>
          </div>
          {team.description && <Text color="secondary">{team.description}</Text>}
        </div>
      </header>
      <ViewToggle view={view} onChange={setView} first="details" />
      </div>

      {view === 'graph' ? (
        <section className="detail-graph-card glass-card" aria-label="Access graph">
          <AccessGraph tree={graph} loading={aclLoading} />
        </section>
      ) : (
      <>

      <DetailSection title="Identity provider mapping">
        <TeamIdpMapping team={team} members={access.members} />
      </DetailSection>

      <DetailSection title="Roles Granted" count={access.roles.length}>
        {access.roles.length === 0 ? (
          <Text color="secondary">This Team grants no Roles.</Text>
        ) : (
          <ul className="role-grant-list">
            {access.roles.map((role) => {
              const product = productForRoleId(role.id);
              return (
                <li key={role.id} className="role-grant-row">
                  <span className="role-grant-name">
                    <Text as="span" variant="body-md-semibold">
                      {role.title || role.id}
                    </Text>
                    {product && (
                      <span className="role-grant-product">{PRODUCT_LABELS[product]}</span>
                    )}
                  </span>
                  {role.description && (
                    <Text color="secondary" variant="body-sm-normal">
                      {role.description}
                    </Text>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DetailSection>

      <DetailSection title="Resource Access">
        <ResourceAccess
          groups={groupAccess}
          loading={aclLoading}
          unavailable={acl?.unavailable}
          showSources={false}
        />
      </DetailSection>

      <DetailSection title="Members" count={access.members.length + access.unresolvedMembers.length}>
        <div className="member-list">
          {!access.membershipListComplete && (
            <Alert appearance="warning" layout="inline" title="Member list may be incomplete">
              Cribl didn't return a membership list for this Team (the{' '}
              <code>/system/teams/{team.id}/users</code> call failed or isn't permitted for this
              app). The members below are inferred from user records only — someone who belongs to
              the Team but has no product role of their own won't appear.
            </Alert>
          )}
          {access.members.length === 0 && access.unresolvedMembers.length === 0 ? (
            <Text color="secondary">
              {access.membershipListComplete
                ? 'No users currently belong to this Team.'
                : 'No members could be inferred.'}
            </Text>
          ) : (
            <>
            {access.members.length > 0 && (
              <div className="chip-row">
                {access.members.map((member) => {
                  const name =
                    [member.first, member.last].filter(Boolean).join(' ') || member.username;
                  return (
                    <TagLink key={member.id} to={`/users/${encodeURIComponent(member.id)}`}>
                      {name}
                    </TagLink>
                  );
                })}
              </div>
            )}
            {access.unresolvedMembers.length > 0 && (
              <div className="member-unresolved">
                <Text color="secondary" variant="body-sm-normal">
                  {access.unresolvedMembers.length} member
                  {access.unresolvedMembers.length === 1 ? '' : 's'} listed by Cribl that this app
                  can't match to an account — most often an SSO user who hasn't signed in to a
                  product yet:
                </Text>
                <div className="chip-row">
                  {access.unresolvedMembers.map((m) => (
                    <Tag key={m} size="sm">
                      {m}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </DetailSection>
      </>
      )}
    </div>
  );
}
