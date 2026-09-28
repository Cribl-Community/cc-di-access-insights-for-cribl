import { EmptyState } from '@capra/core';
import { GroupOutlined } from '@capra/icons';
import type { Team } from '../api/types';
import { SearchField } from './SearchField';
import { ListFilterChip } from './ListFilterChip';
import { EntityRow } from './EntityRow';
import './EntityList.css';

interface TeamListProps {
  teams: Team[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedTeamId?: string;
  onSelect: (id: string) => void;
  filterLabel?: string;
  onClearFilter?: () => void;
}

export function TeamList({
  teams,
  query,
  onQueryChange,
  selectedTeamId,
  onSelect,
  filterLabel,
  onClearFilter,
}: TeamListProps) {
  return (
    <div className="entity-list">
      <div className="entity-list-search">
        <SearchField
          value={query}
          onChange={onQueryChange}
          placeholder="Search teams…"
          aria-label="Search teams"
        />
        {filterLabel && onClearFilter && (
          <ListFilterChip label={filterLabel} count={teams.length} onClear={onClearFilter} />
        )}
      </div>
      {teams.length > 0 && (
        <span className="entity-list-count">
          {teams.length} {teams.length === 1 ? 'team' : 'teams'}
        </span>
      )}
      <ul className="entity-list-items">
        {teams.length === 0 && (
          <li className="entity-list-empty">
            <EmptyState
              size="md"
              title="No matching teams"
              description={filterLabel ? 'No teams match this filter.' : 'Try a different search term.'}
            />
          </li>
        )}
        {teams.map((team) => (
          <EntityRow
            key={team.id}
            avatar={<GroupOutlined />}
            avatarTone="highlight"
            title={team.name}
            subtitle={team.description || undefined}
            selected={team.id === selectedTeamId}
            onClick={() => onSelect(team.id)}
          />
        ))}
      </ul>
    </div>
  );
}
