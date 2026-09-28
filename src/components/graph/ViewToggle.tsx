import { BranchesOutlined, Grid2 } from '@capra/icons';
import type { DetailView } from './useDetailView';
import './ViewToggle.css';

interface ViewToggleProps {
  view: DetailView;
  onChange: (v: DetailView) => void;
  /** Which option comes first — the page's default view. */
  first?: DetailView;
}

export function ViewToggle({ view, onChange, first = 'graph' }: ViewToggleProps) {
  const graph = (
      <button
        type="button"
        className={`view-toggle-item${view === 'graph' ? ' view-toggle-active' : ''}`}
        aria-pressed={view === 'graph'}
        onClick={() => onChange('graph')}
      >
        <BranchesOutlined size="sm" aria-hidden /> Graph
      </button>
  );
  const details = (
      <button
        type="button"
        className={`view-toggle-item${view === 'details' ? ' view-toggle-active' : ''}`}
        aria-pressed={view === 'details'}
        onClick={() => onChange('details')}
      >
        <Grid2 size="sm" aria-hidden /> Details
      </button>
  );
  return (
    <div className="view-toggle" role="group" aria-label="View">
      {first === 'details' ? (
        <>
          {details}
          {graph}
        </>
      ) : (
        <>
          {graph}
          {details}
        </>
      )}
    </div>
  );
}
