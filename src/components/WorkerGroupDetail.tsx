import { useMemo } from 'react';
import { EmptyState, Spinner, Tag, Text } from '@capra/core';
import { WorkersOutlined } from '@capra/icons';
import {
  GROUP_KIND_LABELS,
  PRODUCT_LABELS,
  type AccessSource,
  type ConfigGroup,
  type CoreProduct,
  type User,
} from '../api/types';
import { formatPolicy, resolveGroupReach } from '../api/acl';
import { reachesGroupOfProduct, type GroupAdminReach } from '../api/access';
import { useRbacData } from '../context/RbacDataContext';
import { useGroupAcl } from '../hooks/useGroupAcl';
import { DetailSection } from './DetailSection';
import { TagLink } from './TagLink';
import './DetailPanel.css';

interface WorkerGroupDetailProps {
  group: ConfigGroup;
  /** Every user with an admin role above the Worker Group level, and what it reaches. */
  adminReachByUser: Array<{ user: User; reach: GroupAdminReach[] }>;
}

function userName(user: User): string {
  return [user.first, user.last].filter(Boolean).join(' ') || user.username || user.id;
}

function SourceTag({ source }: { source: AccessSource }) {
  switch (source.kind) {
    case 'direct':
      return <Tag size="sm">Direct</Tag>;
    case 'workspace':
      return (
        <Tag size="sm" color="highlight">
          {`Workspace: ${source.workspaceId}`}
        </Tag>
      );
    case 'team':
      return (
        <TagLink to={`/teams/${encodeURIComponent(source.teamId)}`} color="info">
          {`via ${source.teamName}`}
        </TagLink>
      );
  }
}

function AccessCell({ policy }: { policy: string | null }) {
  return policy ? (
    <Tag color="success" size="sm">
      {formatPolicy(policy)}
    </Tag>
  ) : (
    <Text color="secondary" variant="body-sm-normal">
      Resource-level only
    </Text>
  );
}

/** The strongest admin level that reaches a group of `product`, and how it was granted. */
function implicitLevelForGroup(
  reach: GroupAdminReach[],
  product: CoreProduct | undefined,
): { label: string; sources: AccessSource[] } | null {
  const org = reach.find((g) => g.scope === 'org');
  if (org) return { label: org.owner ? 'Organization owner' : 'Organization admin', sources: org.sources };
  const ws = reach.find((g) => g.scope === 'workspace');
  if (ws) return { label: ws.owner ? 'Workspace owner' : 'Workspace admin', sources: ws.sources };
  const pg = reach.find((g) => g.scope === 'product' && g.product === product);
  if (pg) return { label: `${product ? PRODUCT_LABELS[product] : 'Product'} admin`, sources: pg.sources };
  return null;
}

export function WorkerGroupDetail({ group, adminReachByUser }: WorkerGroupDetailProps) {
  const { users, teams, userById, teamById, resolveTeamAccess } = useRbacData();
  const { data: acl, loading } = useGroupAcl(group.product, group.id);

  const reach = useMemo(
    () =>
      acl
        ? resolveGroupReach({
            acl,
            gid: group.id,
            users,
            teams,
            userById,
            teamById,
            resolveTeamAccess,
          })
        : null,
    [acl, group.id, users, teams, userById, teamById, resolveTeamAccess],
  );

  const implicitAdmins = useMemo(
    () =>
      adminReachByUser
        .filter(({ reach: r }) => reachesGroupOfProduct(r, group.product))
        .map(({ user, reach: r }) => ({ user, level: implicitLevelForGroup(r, group.product)! }))
        .sort((a, b) => userName(a.user).localeCompare(userName(b.user))),
    [adminReachByUser, group.product],
  );

  const kind = group.product ? GROUP_KIND_LABELS[group.product] : 'Group';

  return (
    <div className="detail-panel">
      <header className="detail-header">
        <div className="detail-avatar detail-avatar-team" aria-hidden>
          <WorkersOutlined />
        </div>
        <div className="detail-header-text">
          <div className="detail-header-title">
            <Text as="h1" variant="heading-md">
              {group.name || group.id}
            </Text>
            <Tag color="highlight" size="sm">
              {kind}
            </Tag>
            {group.product && (
              <Tag color="default" size="sm">
                {PRODUCT_LABELS[group.product]}
              </Tag>
            )}
          </div>
          <Text color="secondary" variant="body-sm-normal">
            {group.id}
          </Text>
          {group.description && <Text color="secondary">{group.description}</Text>}
        </div>
      </header>

      {implicitAdmins.length > 0 && (
        <DetailSection title="Implicit admin access" count={implicitAdmins.length}>
          <Text color="secondary" variant="body-sm-normal">
            These users have Admin on this {kind.toLowerCase()} through an org, Workspace, or product
            admin role — no explicit grant needed.
          </Text>
          <table className="detail-table detail-table-spaced">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Admin role</th>
                <th scope="col">Via</th>
              </tr>
            </thead>
            <tbody>
              {implicitAdmins.map(({ user, level }) => (
                <tr key={user.id}>
                  <td>
                    <span className="chip-row">
                      <TagLink to={`/users/${encodeURIComponent(user.id)}`}>{userName(user)}</TagLink>
                      {user.disabled && (
                        <Tag color="danger" size="sm">
                          Disabled
                        </Tag>
                      )}
                    </span>
                  </td>
                  <td>
                    <Tag color="highlight" size="sm">
                      {level.label}
                    </Tag>
                  </td>
                  <td>
                    <span className="chip-row">
                      {level.sources.length > 0 ? (
                        level.sources.map((s, i) => <SourceTag key={i} source={s} />)
                      ) : (
                        <Tag size="sm">Direct</Tag>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailSection>
      )}

      <DetailSection title="Explicit access" count={reach?.users.length ?? 0}>
        {loading || !reach ? (
          <div className="detail-loading">
            <Spinner size="sm" title="Loading access…" />
          </div>
        ) : acl?.unavailable ? (
          <EmptyState
            size="md"
            title="Access list unavailable"
            description="This app wasn't able to read the access control list for this group."
          />
        ) : reach.users.length === 0 ? (
          <EmptyState
            size="md"
            title="No explicit access"
            description="No user has a direct or Team-inherited grant on this group (see implicit access above)."
          />
        ) : (
          <table className="detail-table">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Access</th>
                <th scope="col">Via</th>
              </tr>
            </thead>
            <tbody>
              {reach.users.map(({ user, policy, sources }) => (
                <tr key={user.id}>
                  <td>
                    <span className="chip-row">
                      <TagLink to={`/users/${encodeURIComponent(user.id)}`}>{userName(user)}</TagLink>
                      {user.disabled && (
                        <Tag color="danger" size="sm">
                          Disabled
                        </Tag>
                      )}
                    </span>
                  </td>
                  <td>
                    <AccessCell policy={policy} />
                  </td>
                  <td>
                    <span className="chip-row">
                      {sources.map((s, i) => (
                        <SourceTag key={i} source={s} />
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {reach && reach.unresolved.length > 0 && (
          <Text color="secondary" variant="body-sm-normal">
            {reach.unresolved.length} grant
            {reach.unresolved.length === 1 ? '' : 's'} to principals not in the roster
            {` (${reach.unresolved.join(', ')})`}.
          </Text>
        )}
      </DetailSection>

      <DetailSection title="Teams with access" count={reach?.teams.length ?? 0}>
        {!reach || reach.teams.length === 0 ? (
          <Text color="secondary">No Team grants access to this group.</Text>
        ) : (
          <table className="detail-table">
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col">Access</th>
                <th scope="col">Members</th>
              </tr>
            </thead>
            <tbody>
              {reach.teams.map(({ team, policy, members }) => (
                <tr key={team.id}>
                  <td>
                    <TagLink to={`/teams/${encodeURIComponent(team.id)}`}>{team.name}</TagLink>
                  </td>
                  <td>
                    <AccessCell policy={policy} />
                  </td>
                  <td>
                    <Text color="secondary" variant="body-sm-normal">
                      {members.length}
                    </Text>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DetailSection>
    </div>
  );
}
