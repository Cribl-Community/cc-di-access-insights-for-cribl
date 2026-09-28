import { Suspense, lazy, type ComponentProps } from 'react';
import type { JsExpressionEditor as EditorType } from './JsExpressionEditor';

// CodeMirror only downloads when the Query page's Expression mode is opened.
const JsExpressionEditor = lazy(() => import('./JsExpressionEditor').then((m) => ({ default: m.JsExpressionEditor })));

export function LazyJsExpressionEditor(props: ComponentProps<typeof EditorType>) {
  return (
    <Suspense fallback={<div className="js-expr-editor-fallback" style={{ minHeight: 88 }} />}>
      <JsExpressionEditor {...props} />
    </Suspense>
  );
}
