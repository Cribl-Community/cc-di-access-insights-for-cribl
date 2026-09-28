import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, EmptyState, Skeleton } from '@capra/core';
import { useRbacData } from '../context/RbacDataContext';
import { USER_FILTERS, classifyAuth, isUserFilterKey } from '../api/overview';
import { MasterDetailLayout } from '../components/MasterDetailLayout';
import { UserList } from '../components/UserList';
import { UserDetail } from '../components/UserDetail';
import { UsersOverview } from '../components/UsersOverview';
import './Page.css';

function displayName(first?: string, last?: string, username?: string): string {
  return [first, last].filter(Boolean).join(' ') || username || '';
}

export function UsersPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading, error, users, userById, resolveUserAccess } = useRbacData();
  const [query, setQuery] = useState('');

  const filterKey = searchParams.get('filter');
  const activeFilter = isUserFilterKey(filterKey) ? filterKey : null;

  // API Credentials live on their own "API Keys" tab, not in the people roster.
  const sortedUsers = useMemo(
    () =>
      users
        .filter((u) => classifyAuth(u) !== 'credential')
        .sort((a, b) =>
          displayName(a.first, a.last, a.username).localeCompare(
            displayName(b.first, b.last, b.username),
          ),
        ),
    [users],
  );

  const filteredUsers = useMemo(() => {
    let list = sortedUsers;
    if (activeFilter) {
      list = list.filter((user) => USER_FILTERS[activeFilter].match(user, resolveUserAccess));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((user) =>
        [user.first, user.last, user.username, user.email].some((field) =>
          field?.toLowerCase().includes(q),
        ),
      );
    }
    return list;
  }, [sortedUsers, query, activeFilter, resolveUserAccess]);

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

  const clearFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('filter');
    setSearchParams(next, { replace: true });
  };

  // Keep the active filter (query string) as the selection changes.
  const search = searchParams.toString();
  const selectUser = (id: string) =>
    navigate(`/users/${encodeURIComponent(id)}${search ? `?${search}` : ''}`);

  const selectedUser = userId ? userById.get(userId) : undefined;

  return (
    <MasterDetailLayout
      selectedKey={selectedUser?.id}
      listLabel="Users"
      list={
        <UserList
          users={filteredUsers}
          query={query}
          onQueryChange={setQuery}
          selectedUserId={userId}
          onSelect={selectUser}
          filterLabel={activeFilter ? USER_FILTERS[activeFilter].label : undefined}
          onClearFilter={clearFilter}
        />
      }
      detail={
        selectedUser ? (
          <UserDetail user={selectedUser} access={resolveUserAccess(selectedUser)} />
        ) : (
          <div className="detail-empty-wrapper">
            {users.length === 0 ? (
              <EmptyState
                illustration="EmptyFolder"
                size="lg"
                title="No users found"
                description="No users were returned for this Workspace."
              />
            ) : (
              <UsersOverview />
            )}
          </div>
        )
      }
    />
  );
}
