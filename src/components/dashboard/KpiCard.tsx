import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { SvgIcon } from '@capra/icons';
import './dashboard.css';

export type ChipTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

interface KpiCardProps {
  icon: SvgIcon;
  label: string;
  value: number;
  /** A real snapshot figure beside the number ("82% SSO") — never an invented trend. */
  chip?: { text: string; tone: ChipTone };
  caption?: string;
  /** Extra rows under the value (e.g. the Needs-attention breakdown). */
  children?: ReactNode;
  to?: string;
}

const fmt = new Intl.NumberFormat('en-US');

/** Stat tile: icon + label header, the value on an inner panel, one context chip. */
export function KpiCard({ icon: Icon, label, value, chip, caption, children, to }: KpiCardProps) {
  const body = (
    <div className="kpi-summary">
      <span className="kpi-value">{fmt.format(value)}</span>
      {(chip || caption) && (
        <span className="kpi-meta">
          {chip && <span className={`status-pill status-pill-${chip.tone}`}>{chip.text}</span>}
          {caption && <span className="kpi-caption">{caption}</span>}
        </span>
      )}
    </div>
  );

  return (
    <section className="kpi-card glass-card" aria-label={label}>
      <header className="kpi-header">
        <span className="kpi-icon" aria-hidden>
          <Icon size="sm" />
        </span>
        <span className="kpi-label">{label}</span>
      </header>
      {/* One inner panel per card that fills the card, so every card's panel lines up. */}
      <div className="kpi-inner">
        {to ? (
          <Link to={to} className="kpi-link">
            {body}
          </Link>
        ) : (
          body
        )}
        {children}
      </div>
    </section>
  );
}
