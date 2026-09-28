import type { ReactNode } from 'react';
import { EmptyState, Tag } from '@capra/core';
import { ApiOutlined } from '@capra/icons';
import type { User } from '../api/types';
import { SearchField } from './SearchField';
import { EntityRow } from './EntityRow';
import { EntitySection } from './EntitySection';
import './EntityList.css';

interface ApiKeyListProps {
  keys: User[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedId?: string;
  onSelect: (id: string) => void;
}

function displayName(key: User): string {
  return [key.first, key.last].filter(Boolean).join(' ') || key.username || key.id;
}

export function ApiKeyList({ keys, query, onQueryChange, selectedId, onSelect }: ApiKeyListProps) {
  const row = (key: User): ReactNode => (
    <EntityRow
      key={key.id}
      avatar={<ApiOutlined />}
      avatarTone="info"
      title={displayName(key)}
      titleTrailing={
        key.disabled ? (
          <Tag color="danger" size="sm">
            Disabled
          </Tag>
        ) : undefined
      }
      subtitle={key.description || key.username}
      selected={key.id === selectedId}
      onClick={() => onSelect(key.id)}
    />
  );

  const active = keys.filter((k) => !k.disabled);
  const disabled = keys.filter((k) => k.disabled);

  return (
    <div className="entity-list">
      <div className="entity-list-search">
        <SearchField
          value={query}
          onChange={onQueryChange}
          placeholder="Search API keys…"
          aria-label="Search API keys"
        />
      </div>
      {keys.length > 0 && (
        <span className="entity-list-count">
          {keys.length} {keys.length === 1 ? 'API key' : 'API keys'}
        </span>
      )}
      <ul className="entity-list-items">
        {keys.length === 0 && (
          <li className="entity-list-empty">
            <EmptyState
              size="md"
              title="No API keys"
              description={query ? 'Try a different search term.' : 'No API Credentials were returned.'}
            />
          </li>
        )}
        {disabled.length === 0 ? (
          keys.map(row)
        ) : (
          <>
            <EntitySection label="Active" count={active.length}>
              {active.map(row)}
            </EntitySection>
            <EntitySection label="Disabled" count={disabled.length}>
              {disabled.map(row)}
            </EntitySection>
          </>
        )}
      </ul>
    </div>
  );
}
