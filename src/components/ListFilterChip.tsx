import { Button, Tag, Text } from '@capra/core';
import './ListFilterChip.css';

interface ListFilterChipProps {
  label: string;
  count: number;
  onClear: () => void;
}

/** Persistent banner above a list showing the active named filter, its count, and a Clear action. */
export function ListFilterChip({ label, count, onClear }: ListFilterChipProps) {
  return (
    <div className="list-filter-chip">
      <div className="list-filter-chip-label">
        <Text color="secondary" variant="body-xs-normal">
          Filtered by
        </Text>
        <Tag color="info" size="sm">
          {`${label} · ${count}`}
        </Tag>
      </div>
      <Button variant="tertiary" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
