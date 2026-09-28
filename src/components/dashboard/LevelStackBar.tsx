import { useState } from 'react';
import { LEVEL_BUCKETS, type LevelBucket } from '../../viz/levels';
import './dashboard.css';

interface LevelStackBarProps {
  counts: Record<LevelBucket, number>;
  total: number;
  /** Include the "No Access" remainder as a segment. */
  includeNone?: boolean;
  onSelect?: (bucket: LevelBucket) => void;
  noun?: string;
}

/**
 * Horizontal part-to-whole bar on the ordinal level ramp. Segments are
 * separated by a 2px surface gap (no borders), each is focusable and shows the
 * same tooltip on hover and focus; the legend below carries every count as text.
 */
export function LevelStackBar({ counts, total, includeNone = true, onSelect, noun = 'users' }: LevelStackBarProps) {
  const [hover, setHover] = useState<LevelBucket | null>(null);
  const buckets = LEVEL_BUCKETS.filter((b) => (includeNone || b.key !== 'none') && counts[b.key] > 0);
  const denom = includeNone ? total : total - counts.none;
  const tip = hover ? LEVEL_BUCKETS.find((b) => b.key === hover) : null;

  return (
    <div className="lsb">
      <div className="lsb-bar" onMouseLeave={() => setHover(null)}>
        {denom === 0 ? (
          <span className="lsb-empty" />
        ) : (
          buckets.map((b) => (
            <button
              key={b.key}
              type="button"
              className="lsb-seg"
              style={{ flexGrow: counts[b.key], background: b.cssVar }}
              aria-label={`${b.label}: ${counts[b.key]} ${noun}`}
              onMouseEnter={() => setHover(b.key)}
              onFocus={() => setHover(b.key)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect?.(b.key)}
            />
          ))
        )}
        {tip && (
          <span className="lsb-tip" role="tooltip">
            <span className="lsb-swatch" style={{ background: tip.cssVar }} />
            {tip.label} · {counts[tip.key]} {noun}
            {denom > 0 ? ` (${Math.round((counts[tip.key] / denom) * 100)}%)` : ''}
          </span>
        )}
      </div>
      <ul className="lsb-legend">
        {buckets.map((b) => (
          <li key={b.key}>
            <button type="button" className="lsb-legend-item" onClick={() => onSelect?.(b.key)}>
              <span className="lsb-swatch" style={{ background: b.cssVar }} aria-hidden />
              <span>{b.label}</span>
              <span className="lsb-legend-count">{counts[b.key]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
