import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, EmptyState, Skeleton } from '@capra/core';
import { useRbacData } from '../context/RbacDataContext';
import { classifyAuth } from '../api/overview';
import { MasterDetailLayout } from '../components/MasterDetailLayout';
import { ApiKeyList } from '../components/ApiKeyList';
import { ApiKeyDetail } from '../components/ApiKeyDetail';
import './Page.css';

function displayName(first?: string, last?: string, username?: string, id?: string): string {
  return [first, last].filter(Boolean).join(' ') || username || id || '';
}

export function ApiKeysPage() {
  const { keyId } = useParams();
  const navigate = useNavigate();
  const { loading, error, users, userById, resolveUserAccess } = useRbacData();
  const [query, setQuery] = useState('');

  const apiKeys = useMemo(
    () =>
      users
        .filter((u) => classifyAuth(u) === 'credential')
        .sort((a, b) =>
          displayName(a.first, a.last, a.username, a.id).localeCompare(
            displayName(b.first, b.last, b.username, b.id),
          ),
        ),
    [users],
  );

  const filteredKeys = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apiKeys;
    return apiKeys.filter((key) =>
      [key.first, key.last, key.username, key.email, key.description, key.id].some((field) =>
        field?.toLowerCase().includes(q),
      ),
    );
  }, [apiKeys, query]);

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

  const selectedKey =
    keyId && classifyAuth(userById.get(keyId) ?? ({} as never)) === 'credential'
      ? userById.get(keyId)
      : undefined;

  return (
    <MasterDetailLayout
      selectedKey={selectedKey?.id}
      listLabel="API Keys"
      list={
        <ApiKeyList
          keys={filteredKeys}
          query={query}
          onQueryChange={setQuery}
          selectedId={keyId}
          onSelect={(id) => navigate(`/api-keys/${encodeURIComponent(id)}`)}
        />
      }
      detail={
        selectedKey ? (
          <ApiKeyDetail apiKey={selectedKey} access={resolveUserAccess(selectedKey)} />
        ) : (
          <div className="detail-empty-wrapper">
            <EmptyState
              illustration="EmptySuitcase"
              size="lg"
              title={apiKeys.length === 0 ? 'No API keys' : 'Select an API key'}
              description={
                apiKeys.length === 0
                  ? 'No API Credentials were returned for this organization.'
                  : 'Choose an API key to see the Roles and resource access it has.'
              }
            />
          </div>
        )
      }
    />
  );
}
