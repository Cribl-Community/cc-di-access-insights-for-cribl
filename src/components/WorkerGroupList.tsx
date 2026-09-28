import type { ReactNode } from 'react';
import { EmptyState } from '@capra/core';
import { Edge, Outposts, Stream } from '@capra/icons';
import type { SvgIcon } from '@capra/icons';
import { CORE_PRODUCTS, GROUP_KIND_LABELS, type ConfigGroup, type CoreProduct } from '../api/types';
import { SearchField } from './SearchField';
import { EntityRow } from './EntityRow';
import { EntitySection } from './EntitySection';
import './EntityList.css';

interface WorkerGroupListProps {
  groups: ConfigGroup[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedGroupId?: string;
  onSelect: (id: string) => void;
}

const PRODUCT_ICON: Record<CoreProduct, SvgIcon> = {
  stream: Stream,
  edge: Edge,
  outpost: Outposts,
};

const PRODUCT_SECTION: Record<CoreProduct, string> = {
  stream: 'Stream Worker Groups',
  edge: 'Edge Fleets',
  outpost: 'Outpost Groups',
};

export function WorkerGroupList({
  groups,
  query,
  onQueryChange,
  selectedGroupId,
  onSelect,
}: WorkerGroupListProps) {
  const row = (group: ConfigGroup): ReactNode => {
    const product = group.product;
    const Icon = product ? PRODUCT_ICON[product] : Stream;
    return (
      <EntityRow
        key={group.id}
        avatar={<Icon />}
        avatarTone="accent"
        title={group.name || group.id}
        subtitle={product ? GROUP_KIND_LABELS[product] : group.id}
        selected={group.id === selectedGroupId}
        onClick={() => onSelect(group.id)}
      />
    );
  };

  const sections = CORE_PRODUCTS.map((product) => ({
    product,
    list: groups.filter((g) => g.product === product),
  })).filter((s) => s.list.length > 0);
  const ungrouped = groups.filter((g) => !g.product);

  return (
    <div className="entity-list">
      <div className="entity-list-search">
        <SearchField
          value={query}
          onChange={onQueryChange}
          placeholder="Search Worker Groups…"
          aria-label="Search Worker Groups"
        />
      </div>
      {groups.length > 0 && (
        <span className="entity-list-count">
          {groups.length} {groups.length === 1 ? 'group' : 'groups'}
        </span>
      )}
      <ul className="entity-list-items">
        {groups.length === 0 && (
          <li className="entity-list-empty">
            <EmptyState
              size="md"
              title="No matching groups"
              description={query ? 'Try a different search term.' : 'No Worker Groups or Fleets were returned.'}
            />
          </li>
        )}
        {sections.length + (ungrouped.length > 0 ? 1 : 0) <= 1
          ? groups.map(row)
          : [
              ...sections.map(({ product, list }) => (
                <EntitySection key={product} label={PRODUCT_SECTION[product]} count={list.length}>
                  {list.map(row)}
                </EntitySection>
              )),
              ungrouped.length > 0 && (
                <EntitySection key="other" label="Other" count={ungrouped.length}>
                  {ungrouped.map(row)}
                </EntitySection>
              ),
            ]}
      </ul>
    </div>
  );
}
