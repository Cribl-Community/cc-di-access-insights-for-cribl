import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import {
  autocompletion,
  snippet,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, bracketMatching, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import {
  QUERY_ARRAY_FIELDS,
  QUERY_FIELD_NAMES,
  QUERY_HELPER_NAMES,
  QUERY_LEVEL_NAMES,
  QUERY_PRODUCT_SCOPES,
  QUERY_STRING_FIELDS,
} from '../api/query';
import './JsExpressionEditor.css';

const ARRAY_METHODS = ['length', 'includes', 'join', 'some', 'every', 'filter', 'map', 'indexOf', 'find', 'slice'];
const STRING_METHODS = [
  'length',
  'includes',
  'startsWith',
  'endsWith',
  'toLowerCase',
  'toUpperCase',
  'trim',
  'slice',
  'indexOf',
  'replace',
  'split',
];

/** A snippet template for each helper — `#{}` places the cursor, later Tab-stops for multi-arg calls. */
const HELPER_SNIPPETS: Record<string, string> = {
  hasTeam: "hasTeam('#{name}')",
  hasRole: "hasRole('#{role}')",
  access: "access('#{scope}')",
  atLeast: "atLeast('#{scope}', '#{level}')",
};

function methodCompletion(name: string, type: string): Completion {
  // `length` is a property, not a call — everything else gets `()` with the cursor placed inside.
  return name === 'length' ? { label: name, type } : { label: name, type, apply: snippet(`${name}(#{})`) };
}

const ARRAY_METHOD_COMPLETIONS = ARRAY_METHODS.map((m) => methodCompletion(m, 'method'));
const STRING_METHOD_COMPLETIONS = STRING_METHODS.map((m) => methodCompletion(m, 'method'));
const ALL_METHOD_COMPLETIONS = [
  ...ARRAY_METHOD_COMPLETIONS,
  ...STRING_METHOD_COMPLETIONS.filter((c) => !ARRAY_METHODS.includes(c.label)),
];

const FIELD_COMPLETIONS: Completion[] = QUERY_FIELD_NAMES.map((f) => ({ label: f, type: 'variable' }));
const HELPER_COMPLETIONS: Completion[] = QUERY_HELPER_NAMES.map((h) => ({
  label: h,
  type: 'function',
  apply: snippet(HELPER_SNIPPETS[h] ?? `${h}(#{})`),
  detail: 'function',
}));
const TOP_LEVEL_COMPLETIONS = [...FIELD_COMPLETIONS, ...HELPER_COMPLETIONS];

/** Live data the string-literal completions need — kept in a ref so it can update without rebuilding the editor. */
export interface QueryEditorData {
  teamNames: string[];
  roleNames: string[];
}

/** Which helper call (and which argument) a cursor inside an open `'...'` is in, from the text immediately before the quote. */
function stringContext(beforeQuote: string): 'team' | 'role' | 'scope' | 'level' | null {
  if (/\bhasTeam\(\s*$/.test(beforeQuote)) return 'team';
  if (/\bhasRole\(\s*$/.test(beforeQuote)) return 'role';
  if (/\b(?:access|atLeast)\(\s*$/.test(beforeQuote)) return 'scope';
  if (/\batLeast\(\s*'[^']*'\s*,\s*$/.test(beforeQuote)) return 'level';
  return null;
}

function makeCompletionSource(data: { current: QueryEditorData }) {
  return (context: CompletionContext): CompletionResult | null => {
    const before = context.state.sliceDoc(0, context.pos);

    // Inside an open single-quoted string: 'te|' — suggest based on which call we're in.
    const openString = before.match(/'([^']*)$/);
    if (openString) {
      const from = context.pos - openString[1].length;
      const beforeQuote = before.slice(0, from - 1);
      const kind = stringContext(beforeQuote);
      if (!kind) return null;
      const options: Completion[] =
        kind === 'team'
          ? data.current.teamNames.map((n) => ({ label: n, type: 'text' }))
          : kind === 'role'
            ? data.current.roleNames.map((n) => ({ label: n, type: 'text' }))
            : kind === 'scope'
              ? QUERY_PRODUCT_SCOPES.map((n) => ({ label: n, type: 'constant' }))
              : QUERY_LEVEL_NAMES.map((n) => ({ label: n, type: 'constant' }));
      return { from, to: context.pos, options, filter: true };
    }

    // After a `.` on a known field: teams.| or name.| — suggest that type's methods.
    const member = context.matchBefore(/([A-Za-z_$][\w$]*)\.(\w*)$/);
    if (member) {
      const dot = member.text.lastIndexOf('.');
      const base = member.text.slice(0, dot);
      const from = member.from + dot + 1;
      const options: Completion[] = (QUERY_ARRAY_FIELDS as readonly string[]).includes(base)
        ? ARRAY_METHOD_COMPLETIONS
        : (QUERY_STRING_FIELDS as readonly string[]).includes(base)
          ? STRING_METHOD_COMPLETIONS
          : ALL_METHOD_COMPLETIONS;
      return { from, to: context.pos, options, filter: true };
    }

    // Otherwise: a plain identifier — suggest fields + helper functions.
    const word = context.matchBefore(/[A-Za-z_$][\w$]*/);
    if (!word && !context.explicit) return null;
    return { from: word ? word.from : context.pos, to: context.pos, options: TOP_LEVEL_COMPLETIONS, filter: true };
  };
}

/** Token colours come from CSS vars (JsExpressionEditor.css) so light and dark each get their own. */
const exprHighlight = HighlightStyle.define([
  { tag: [t.string, t.special(t.string)], color: 'var(--expr-string)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--expr-fn)' },
  { tag: t.propertyName, color: 'var(--expr-prop)' },
  { tag: [t.keyword, t.bool, t.null, t.self], color: 'var(--expr-keyword)' },
  { tag: t.number, color: 'var(--expr-number)' },
  { tag: [t.operator, t.logicOperator, t.compareOperator, t.punctuation, t.bracket], color: 'var(--expr-op)' },
  { tag: t.variableName, color: 'var(--expr-var)' },
  { tag: t.comment, color: 'var(--expr-comment)', fontStyle: 'italic' },
]);

const editorTheme = EditorView.theme({
  '&': {
    fontSize: '13px',
    backgroundColor: 'var(--cds2-color-background-surface)',
    color: 'var(--cds2-color-foreground-default)',
    border: '1px solid var(--cds2-color-border-neutral-subtle)',
    borderRadius: 'var(--cds2-radius-md)',
  },
  '&.cm-focused': {
    outline: 'none',
    borderColor: 'var(--cds2-color-border-focus)',
    boxShadow: '0 0 0 1px var(--cds2-color-border-focus)',
  },
  '.cm-content': {
    padding: '10px 12px',
    caretColor: 'var(--cds2-color-foreground-default)',
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', Consolas, monospace",
  },
  '.cm-line': { padding: 0 },
  '.cm-scroller': { overflow: 'auto', maxHeight: '160px' },
  '.cm-content, .cm-scroller': { minHeight: '64px' },
  '.cm-placeholder': { color: 'var(--cds2-color-foreground-subtle)' },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    border: '1px solid var(--cds2-color-border-neutral-subtle)',
    borderRadius: 'var(--cds2-radius-md)',
    backgroundColor: 'var(--cds2-color-background-surface)',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.16)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete ul': { fontFamily: 'inherit', fontSize: '13px' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--cds2-color-background-accent-subtle)',
    color: 'var(--cds2-color-foreground-default)',
  },
  '.cm-completionIcon': { display: 'none' },
});

interface JsExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRunNow: () => void;
  data: QueryEditorData;
  placeholder?: string;
  'aria-label'?: string;
}

/**
 * A JS expression box with syntax highlighting and live autocomplete for the
 * query language's fields, helpers, and (inside a helper's string argument)
 * the org's actual Team / Role names — the same "editor knows the schema"
 * experience as Cribl's own JS expression fields.
 */
export function JsExpressionEditor({
  value,
  onChange,
  onRunNow,
  data,
  placeholder,
  'aria-label': ariaLabel,
}: JsExpressionEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunNowRef = useRef(onRunNow);
  const dataRef = useRef(data);
  onChangeRef.current = onChange;
  onRunNowRef.current = onRunNow;
  dataRef.current = data;

  useEffect(() => {
    if (!hostRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        javascript(),
        syntaxHighlighting(exprHighlight),
        bracketMatching(),
        history(),
        autocompletion({ override: [makeCompletionSource(dataRef)], activateOnTyping: true }),
        keymap.of([
          { key: 'Mod-Enter', run: () => (onRunNowRef.current(), true) },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.lineWrapping,
        placeholderExt(placeholder ?? ''),
        EditorView.contentAttributes.of(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        editorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only (re)create the editor once — `value` is applied externally below,
    // and everything else needed live is read through the refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external changes to `value` (e.g. an example chip) into the editor
  // without disrupting the cursor when the change came from typing here.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value }, selection: { anchor: value.length } });
    }
  }, [value]);

  return <div ref={hostRef} className="js-expr-editor" />;
}
