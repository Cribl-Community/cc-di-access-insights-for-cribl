import { Suspense, lazy, type ComponentProps } from 'react';
import { Spinner } from '@capra/core';
import type { AccessGraph as AccessGraphType } from './AccessGraph';

// React Flow + d3 only download when a graph is first shown.
const AccessGraph = lazy(() => import('./AccessGraph').then((m) => ({ default: m.AccessGraph })));

export function LazyAccessGraph(props: ComponentProps<typeof AccessGraphType>) {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner size="sm" title="Loading graph…" />
        </div>
      }
    >
      <AccessGraph {...props} />
    </Suspense>
  );
}
