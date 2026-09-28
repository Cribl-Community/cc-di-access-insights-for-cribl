import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ListUnordered } from '@capra/icons';
import './MasterDetailLayout.css';

interface MasterDetailLayoutProps {
  list: ReactNode;
  detail: ReactNode;
  /**
   * The id of the selected item, if any. With a selection the list folds into a
   * slim rail so the detail (e.g. the access graph) gets the full width; the rail
   * reopens it as a drawer, which closes again when the selection changes.
   */
  selectedKey?: string;
  /** What the list holds, e.g. "Users" — labels the rail button. */
  listLabel?: string;
}

export function MasterDetailLayout({ list, detail, selectedKey, listLabel = 'List' }: MasterDetailLayoutProps) {
  const listId = useId();
  const collapsed = selectedKey !== undefined;
  // Remember which selection the drawer was opened for: picking another item closes it.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const drawerOpen = collapsed && openFor === selectedKey;
  const railBtnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const el = listRef.current;
    el?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'center' });
    el?.querySelector<HTMLInputElement>('input')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpenFor(null);
      railBtnRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const classes = ['master-detail', collapsed && 'is-collapsed', drawerOpen && 'is-drawer-open'].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {collapsed && (
        <div className="master-detail-rail">
          <button
            ref={railBtnRef}
            type="button"
            className="md-rail-btn"
            aria-expanded={drawerOpen}
            aria-controls={listId}
            title={drawerOpen ? `Hide ${listLabel.toLowerCase()}` : `Show ${listLabel.toLowerCase()}`}
            onClick={() => setOpenFor(drawerOpen ? null : (selectedKey ?? null))}
          >
            <ListUnordered size="sm" aria-hidden />
            <span className="md-rail-label">{listLabel}</span>
          </button>
        </div>
      )}
      <div id={listId} ref={listRef} className="master-detail-list" aria-hidden={collapsed && !drawerOpen ? true : undefined}>
        {list}
      </div>
      {drawerOpen && <div className="md-scrim" onClick={() => setOpenFor(null)} aria-hidden />}
      <div className="master-detail-detail">{detail}</div>
    </div>
  );
}
