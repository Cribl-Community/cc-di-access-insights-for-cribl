import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, EmptyState, Skeleton } from '@capra/core';
import { useRbacData } from '../context/RbacDataContext';
import { resolveGroupAdminReach } from '../api/access';
import { MasterDetailLayout } from '../components/MasterDetailLayout';
import { WorkerGroupList } from '../components/WorkerGroupList';
import { WorkerGroupDetail } from '../components/WorkerGroupDetail';
import './Page.css';
import '../components/shell/DirectoryLayout.css';
import { PageHeader } from '../components/shell/PageHeader';

export function WorkerGroupsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { loading, error, groups, groupById, users, resolveUserAccess } = useRbacData();
  const [query, setQuery] = useState('');

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id)),
    [groups],
  );

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedGroups;
    return sortedGroups.filter((g) =>
      [g.id, g.name, g.description].some((field) => field?.toLowerCase().includes(q)),
    );
  }, [sortedGroups, query]);

  // Users with an admin role above the Worker Group level — they reach groups
  // implicitly (org / Workspace / per-product), which no ACL endpoint reports.
  const adminReachByUser = useMemo(
    () =>
      users
        .map((user) => ({ user, reach: resolveGroupAdminReach(user, resolveUserAccess(user).effectiveRoles) }))
        .filter(({ reach }) => reach.length > 0),
    [users, resolveUserAccess],
  );

  if (loading) {
    return (
      <div className="page-status">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-status">
        <Alert appearance="danger" title="Couldn't load RBAC data">
          {error}
        </Alert>
      </div>
    );
  }

  const selectedGroup = groupId ? groupById.get(groupId) : undefined;

  return (
    <div className="directory-page">
      <div className="directory-header">
        <PageHeader
          title="Worker Group lookup"
          subtitle="Pick a Worker Group, Fleet, or Outpost Group to see which users and Teams can access it — and how."
        />
      </div>
      <div className="directory-body glass-card">
        <MasterDetailLayout
          selectedKey={selectedGroup?.id}
          listLabel="Worker Groups"
          list={
            <WorkerGroupList
              groups={filteredGroups}
              query={query}
              onQueryChange={setQuery}
              selectedGroupId={groupId}
              onSelect={(id) => navigate(`/worker-groups/${encodeURIComponent(id)}`)}
            />
          }
          detail={
            selectedGroup ? (
              <WorkerGroupDetail group={selectedGroup} adminReachByUser={adminReachByUser} />
            ) : (
              <div className="detail-empty-wrapper">
                <EmptyState
                  illustration="EmptyFolder"
                  size="lg"
                  title={groups.length === 0 ? 'No Worker Groups found' : 'Select a Worker Group'}
                  description={
                    groups.length === 0
                      ? 'No Worker Groups, Fleets, or Outpost Groups were returned.'
                      : 'Choose a group to see which users and Teams can access it.'
                  }
                />
              </div>
            )
          }
        />
      </div>
    </div>
  );
}
