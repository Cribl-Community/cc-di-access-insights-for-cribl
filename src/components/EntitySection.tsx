import { useState, type ReactNode } from 'react';
import { CaretDown, CaretRight } from '@capra/icons';
import './EntityList.css';

interface EntitySectionProps {
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** A collapsible, titled group of rows in a master list (styled after Cribl's nav). */
export function EntitySection({ label, count, defaultOpen = true, children }: EntitySectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <li className="entity-section">
      <button
        type="button"
        className="entity-section-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="entity-section-caret" aria-hidden>
          {open ? <CaretDown /> : <CaretRight />}
        </span>
        <span className="entity-section-label">{label}</span>
        <span className="entity-section-count">{count}</span>
      </button>
      {open && <ul className="entity-section-items">{children}</ul>}
    </li>
  );
}
