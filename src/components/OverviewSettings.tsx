import { useState } from 'react';
import { Button, Checkbox, IconButton, Popover, Text } from '@capra/core';
import { CustomSettings } from '@capra/icons';
import './OverviewSettings.css';

interface TileOption {
  key: string;
  label: string;
  section: string;
}

interface OverviewSettingsProps {
  tiles: TileOption[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
}

/** Gear button + popover for choosing which Overview tiles are shown. */
export function OverviewSettings({ tiles, hidden, onToggle, onShowAll }: OverviewSettingsProps) {
  const [open, setOpen] = useState(false);
  const sections = [...new Set(tiles.map((t) => t.section))];
  const anyHidden = tiles.some((t) => hidden.has(t.key));

  const content = (
    <div className="overview-settings">
      <div className="overview-settings-head">
        <Text variant="body-md-semibold">Shown tiles</Text>
        <Button variant="tertiary" size="sm" onClick={onShowAll} disabled={!anyHidden}>
          Reset
        </Button>
      </div>
      {sections.map((section) => (
        <div className="overview-settings-group" key={section}>
          <Text color="secondary" variant="body-xs-normal">
            {section}
          </Text>
          {tiles
            .filter((t) => t.section === section)
            .map((t) => (
              <Checkbox key={t.key} checked={!hidden.has(t.key)} onChange={() => onToggle(t.key)}>
                {t.label}
              </Checkbox>
            ))}
        </div>
      ))}
    </div>
  );

  return (
    <Popover content={content} isOpen={open} onOpenChange={setOpen} placement="bottomRight">
      <IconButton
        icon={CustomSettings}
        aria-label="Choose which tiles to show"
        variant="secondary"
        size="sm"
      />
    </Popover>
  );
}
