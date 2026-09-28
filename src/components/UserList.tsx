import { EmptyState, Tag } from '@capra/core';
import type { User } from '../api/types';
import { SearchField } from './SearchField';
import { ListFilterChip } from './ListFilterChip';
import { EntityRow } from './EntityRow';
import { initials } from '../lib/initials';
import './EntityList.css';

interface UserListProps {
  users: User[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedUserId?: string;
  onSelect: (id: string) => void;
  filterLabel?: string;
  onClearFilter?: () => void;
}

function displayName(user: User): string {
  return [user.first, user.last].filter(Boolean).join(' ') || user.username;
}

export function UserList({
  users,
  query,
  onQueryChange,
  selectedUserId,
  onSelect,
  filterLabel,
  onClearFilter,
}: UserListProps) {
  return (
    <div className="entity-list">
      <div className="entity-list-search">
        <SearchField
          value={query}
          onChange={onQueryChange}
          placeholder="Search users…"
          aria-label="Search users"
        />
        {filterLabel && onClearFilter && (
          <ListFilterChip label={filterLabel} count={users.length} onClear={onClearFilter} />
        )}
      </div>
      {users.length > 0 && (
        <span className="entity-list-count">
          {users.length} {users.length === 1 ? 'user' : 'users'}
        </span>
      )}
      <ul className="entity-list-items">
        {users.length === 0 && (
          <li className="entity-list-empty">
            <EmptyState
              size="md"
              title="No matching users"
              description={filterLabel ? 'No users match this filter.' : 'Try a different search term.'}
            />
          </li>
        )}
        {users.map((user) => {
          const name = displayName(user);
          return (
            <EntityRow
              key={user.id}
              avatar={initials(name)}
              avatarTone="accent"
              title={name}
              titleTrailing={
                user.disabled ? (
                  <Tag color="danger" size="sm">
                    Disabled
                  </Tag>
                ) : undefined
              }
              subtitle={user.email || user.username}
              selected={user.id === selectedUserId}
              onClick={() => onSelect(user.id)}
            />
          );
        })}
      </ul>
    </div>
  );
}
