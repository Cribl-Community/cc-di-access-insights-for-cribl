import { useSearchParams } from 'react-router-dom';

export type DetailView = 'graph' | 'details';

/**
 * Graph vs Details, kept in `?view=` so it survives changing selection. Only the
 * non-default view is written to the URL.
 */
export function useDetailView(defaultView: DetailView = 'graph'): [DetailView, (v: DetailView) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('view');
  const view: DetailView = raw === 'graph' || raw === 'details' ? raw : defaultView;
  const set = (v: DetailView) => {
    const next = new URLSearchParams(params);
    if (v === defaultView) next.delete('view');
    else next.set('view', v);
    setParams(next, { replace: true });
  };
  return [view, set];
}
