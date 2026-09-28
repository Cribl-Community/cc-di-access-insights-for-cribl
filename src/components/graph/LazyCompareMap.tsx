import { Suspense, lazy, type ComponentProps } from 'react';
import { Spinner } from '@capra/core';
import type { CompareMap as CompareMapType } from './CompareMap';

const CompareMap = lazy(() => import('./CompareMap').then((m) => ({ default: m.CompareMap })));

export function LazyCompareMap(props: ComponentProps<typeof CompareMapType>) {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spinner size="sm" title="Loading map…" />
        </div>
      }
    >
      <CompareMap {...props} />
    </Suspense>
  );
}
