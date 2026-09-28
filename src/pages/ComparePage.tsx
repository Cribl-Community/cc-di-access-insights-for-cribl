import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, EmptyState, Skeleton } from '@capra/core';
import { useRbacData } from '../context/RbacDataContext';
import { classifyAuth } from '../api/overview';
import { UserPicker } from '../components/UserPicker';
import { PageHeader } from '../components/shell/PageHeader';
import { CompareView } from '../components/CompareView';
import './ComparePage.css';
import './Page.css';

export function ComparePage() {
  const { loading, error, users, userById, resolveUserAccess } = useRbacData();
  const [searchParams, setSearchParams] = useSearchParams();

  const people = useMemo(() => users.filter((u) => classifyAuth(u) !== 'credential'), [users]);

  const aId = searchParams.get('a');
  const bId = searchParams.get('b');
  const userA = aId ? userById.get(aId) : undefined;
  const userB = bId ? userById.get(bId) : undefined;

  const setParam = (key: 'a' | 'b', value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const swap = () => {
    const next = new URLSearchParams(searchParams);
    if (aId) next.set('b', aId);
    else next.delete('b');
    if (bId) next.set('a', bId);
    else next.delete('a');
    setSearchParams(next, { replace: true });
  };

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

  const sameUser = Boolean(userA && userB && userA.id === userB.id);

  return (
    <div className="compare-page">
      <PageHeader
        title="Access Check"
        subtitle="Pick two users to see where their teams, roles, and effective access overlap — and where they don’t."
      />
      <div className="compare-pickers glass-card">
        <UserPicker
          label="User A"
          users={people}
          value={aId}
          onChange={(id) => setParam('a', id)}
          excludeId={bId}
        />
        <Button variant="secondary" size="sm" onClick={swap} disabled={!aId && !bId}>
          Swap
        </Button>
        <UserPicker
          label="User B"
          users={people}
          value={bId}
          onChange={(id) => setParam('b', id)}
          excludeId={aId}
        />
      </div>

      {sameUser ? (
        <Alert appearance="warning" title="Same user selected">
          Pick two different users to compare.
        </Alert>
      ) : userA && userB ? (
        <CompareView
          userA={userA}
          userB={userB}
          accessA={resolveUserAccess(userA)}
          accessB={resolveUserAccess(userB)}
        />
      ) : (
        <div className="detail-empty-wrapper">
          <EmptyState
            illustration="EmptySuitcase"
            size="lg"
            title="Select two users"
            description="Choose a user in each dropdown above to build the comparison."
          />
        </div>
      )}
    </div>
  );
}
