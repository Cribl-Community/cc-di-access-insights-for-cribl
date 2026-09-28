import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, Button, Checkbox, Collapse, EmptyState, Label, Skeleton, Spinner, Tag, Text } from '@capra/core';
import { Download, FilterOutlined, Terminal } from '@capra/icons';
import { useRbacData } from '../context/RbacDataContext';
import { classifyAuth } from '../api/overview';
import {
  QUERY_EXAMPLES,
  buildQueryRecord,
  compileUserQuery,
  downloadCsv,
  runUserQuery,
  usersToCsv,
  type UserQueryRecord,
} from '../api/query';
import { LazyJsExpressionEditor as JsExpressionEditor } from '../components/LazyJsExpressionEditor';
import { LEVEL_BUCKET_BY_KEY, levelBucket } from '../viz/levels';
import { PageHeader } from '../components/shell/PageHeader';
import { QueryBuilderPanel } from '../components/query/QueryBuilderPanel';
import { builderToExpression, newCondition, type BuilderState } from '../api/queryBuilder';
import './QueryPage.css';
import './Page.css';

const AUTH_LABELS: Record<UserQueryRecord['authKind'], string> = {
  saml: 'SAML',
  sso: 'SSO',
  local: 'Local',
  credential: 'API key',
};

const LEVEL_COLUMNS: Array<{ key: keyof UserQueryRecord; label: string }> = [
  { key: 'workspaceLevel', label: 'Workspace' },
  { key: 'stream', label: 'Stream' },
  { key: 'edge', label: 'Edge' },
  { key: 'search', label: 'Search' },
  { key: 'lake', label: 'Lake' },
  { key: 'outpost', label: 'Outpost' },
];

function LevelTag({ value }: { value: string }) {
  const bucket = LEVEL_BUCKET_BY_KEY[levelBucket(value)];
  return (
    <span className={`level-pill${bucket.key === 'none' ? ' level-pill-none' : ''}`}>
      <span className="level-pill-dot" style={{ background: bucket.cssVar }} aria-hidden />
      {value}
    </span>
  );
}

interface RunState {
  compileError: string | null;
  matches: UserQueryRecord[];
  rowErrors: string[];
  total: number;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/** How long to wait after the last keystroke before auto-running the query. */
const AUTO_RUN_DELAY_MS = 350;

type QueryMode = 'builder' | 'expression';

const MODES: Array<{ key: QueryMode; label: string; icon: typeof FilterOutlined; hint: string }> = [
  { key: 'builder', label: 'Builder', icon: FilterOutlined, hint: 'Pick fields and values — no syntax needed.' },
  { key: 'expression', label: 'Expression', icon: Terminal, hint: 'Write a JavaScript filter, like Cribl’s Filter fields.' },
];

function isMode(v: string | null): v is QueryMode {
  return v === 'builder' || v === 'expression';
}

export function QueryPage() {
  const { loading, error, users, teams, roles, resolveUserAccess } = useRbacData();
  // `?q=` pre-fills (and, via the live auto-run, runs) an expression — the Dashboard links in with one.
  // `?mode=` picks the tab; with neither, the Builder opens.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawMode = searchParams.get('mode');
  const mode: QueryMode = isMode(rawMode) ? rawMode : searchParams.get('q') ? 'expression' : 'builder';
  const setMode = (m: QueryMode) => {
    const next = new URLSearchParams(searchParams);
    next.set('mode', m);
    setSearchParams(next, { replace: true });
  };
  const [expression, setExpression] = useState(() => searchParams.get('q') ?? '');
  const [builder, setBuilder] = useState<BuilderState>(() => ({ match: 'all', conditions: [newCondition('admin')] }));
  const [includeCredentials, setIncludeCredentials] = useState(false);
  const [result, setResult] = useState<RunState | null>(null);
  const [pending, setPending] = useState(false);

  const records = useMemo(() => {
    const base = includeCredentials ? users : users.filter((u) => classifyAuth(u) !== 'credential');
    return base.map((u) => buildQueryRecord(u, resolveUserAccess(u)));
  }, [users, resolveUserAccess, includeCredentials]);

  // Live data for the editor's string-literal autocomplete (hasTeam(…) / hasRole(…)).
  const editorData = useMemo(
    () => ({
      teamNames: [...new Set(teams.map((t) => t.name))].sort(),
      roleNames: [...new Set(roles.map((r) => r.title || r.id))].sort(),
    }),
    [teams, roles],
  );

  const run = useCallback(
    (expr: string) => {
      try {
        const compiled = compileUserQuery(expr);
        const { matches, errors, total } = runUserQuery(compiled, records);
        setResult({ compileError: null, matches, rowErrors: errors, total });
      } catch (err) {
        setResult({
          compileError: err instanceof Error ? err.message : String(err),
          matches: [],
          rowErrors: [],
          total: records.length,
        });
      }
      setPending(false);
    },
    [records],
  );

  // Auto-run as you type: debounced so the expression settles before it's
  // compiled — otherwise every keystroke inside a string literal ('like
  // this') would flash a parse error. The Run button / ⌘+Enter still runs
  // immediately, bypassing the debounce.
  // Every mode ends in an expression; that's what runs.
  const activeExpression = mode === 'builder' ? builderToExpression(builder) : expression;

  useEffect(() => {
    if (!activeExpression.trim()) {
      setResult(null);
      setPending(false);
      return;
    }
    setPending(true);
    const handle = window.setTimeout(() => run(activeExpression), AUTO_RUN_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [activeExpression, run]);

  const editAsExpression = (expr: string) => {
    setExpression(expr);
    setMode('expression');
  };

  const exportCsv = () => {
    if (!result || result.matches.length === 0) return;
    downloadCsv(`access-insights-query-${timestamp()}.csv`, usersToCsv(result.matches));
  };

  if (loading) {
    return (
      <div className="page-status">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-status">
        <Alert appearance="danger" title="Couldn't load RBAC data">
          {error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="query-page">
      <PageHeader
        title="Query"
        subtitle="Find the accounts that match a condition, then export them to CSV."
      />

      <div className="query-builder glass-card">
        <div className="query-mode-bar">
          <div className="qm-tabs" role="tablist" aria-label="How to query">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  className="qm-tab"
                  aria-selected={mode === m.key}
                  onClick={() => setMode(m.key)}
                >
                  <Icon size="sm" aria-hidden />
                  {m.label}
                </button>
              );
            })}
          </div>
          <p className="qm-hint">{MODES.find((m) => m.key === mode)!.hint}</p>
        </div>

        {mode === 'builder' && (
          <QueryBuilderPanel
            state={builder}
            onChange={setBuilder}
            teamNames={editorData.teamNames}
            roleNames={editorData.roleNames}
            onEditAsExpression={editAsExpression}
          />
        )}

        {mode === 'expression' && (
          <>
            <div className="query-expression-field">
              <Label>Expression</Label>
              <JsExpressionEditor
                value={expression}
                onChange={setExpression}
                onRunNow={() => run(expression)}
                data={editorData}
                placeholder="isOrgAdmin"
                aria-label="Query expression"
              />
              <Text color="secondary" variant="body-xs-normal">
                Updates the list below as you type — or press ⌘/Ctrl+Enter to run immediately.
                Autocompletes fields, functions, and (inside quotes) your actual Team / Role names.
              </Text>
            </div>

            <div className="query-examples">
              <Text color="secondary" variant="body-xs-normal">
                Examples
              </Text>
              <div className="chip-row">
                {QUERY_EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    className="query-example-chip"
                    title={ex.expression}
                    onClick={() => setExpression(ex.expression)}
                  >
                    {ex.label}
                    {ex.isTemplate && <span className="query-example-template">edit &amp; run</span>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="query-builder-row">
          {mode === 'expression' && (
            <Button variant="primary" size="sm" leadingIcon={FilterOutlined} onClick={() => run(expression)}>
              Run now
            </Button>
          )}
          <Checkbox checked={includeCredentials} onChange={() => setIncludeCredentials((v) => !v)}>
            Include API Credentials
          </Checkbox>
          {pending && (
            <span className="query-pending" aria-live="polite">
              <Spinner size="sm" title="Updating…" />
              <Text color="secondary" variant="body-xs-normal">
                Updating…
              </Text>
            </span>
          )}
        </div>

        {mode === 'expression' && (
          <Collapse title="Fields &amp; functions reference" defaultExpanded={false}>
            <div className="query-reference">
                <div>
                  <Text variant="body-sm-semibold">Fields</Text>
                  <Text color="secondary" variant="body-sm-normal">
                    <code>name</code>, <code>email</code>, <code>username</code>, <code>disabled</code>,{' '}
                    <code>authKind</code> (<code>'saml'|'sso'|'local'|'credential'</code>),{' '}
                    <code>isOrgAdmin</code>, <code>isWorkspaceAdmin</code>, <code>isAnyAdmin</code>,{' '}
                    <code>teams</code> / <code>teamIds</code> (arrays), <code>roles</code> /{' '}
                    <code>roleIds</code> (arrays), <code>workspaceLevel</code>, <code>stream</code>,{' '}
                    <code>edge</code>, <code>search</code>, <code>lake</code>, <code>outpost</code> (each a
                    level string, or &ldquo;No Access&rdquo;).
                  </Text>
                </div>
                <div>
                  <Text variant="body-sm-semibold">Functions</Text>
                  <Text color="secondary" variant="body-sm-normal">
                    <code>hasTeam('Team Name')</code>, <code>hasRole('Role')</code>,{' '}
                    <code>access('stream')</code> → level string, <code>atLeast('stream', 'editor')</code>{' '}
                    → boolean.
                  </Text>
                </div>
                <div>
                  <Text variant="body-sm-semibold">Examples</Text>
                  <Text color="secondary" variant="body-sm-normal">
                    <code>isOrgAdmin</code> · <code>disabled &amp;&amp; teams.length === 0</code> ·{' '}
                    <code>hasTeam('Platform') &amp;&amp; atLeast('stream', 'editor')</code>
                  </Text>
                </div>
                <div>
                  <Text variant="body-sm-semibold">Case sensitivity</Text>
                  <Text color="secondary" variant="body-sm-normal">
                    <code>.includes()</code>, <code>.startsWith()</code>, <code>.endsWith()</code>, and{' '}
                    <code>.indexOf()</code> ignore case on free-text fields like <code>name</code> — so{' '}
                    <code>name.startsWith('alex')</code> matches &ldquo;Alex Morgan&rdquo;. Exact
                    comparisons (<code>===</code>) still match exactly, which is what you want for{' '}
                    <code>authKind</code> and the level fields.
                  </Text>
                </div>
              </div>
          </Collapse>
        )}
      </div>

      <div className="query-results glass-card">
        {result?.compileError && (
          <Alert appearance="danger" title="Couldn't run that query">
            {result.compileError}
          </Alert>
        )}

        {result && !result.compileError && result.rowErrors.length > 0 && (
          <Alert appearance="warning" title="Some users couldn't be evaluated">
            {result.rowErrors[0]}
            {result.rowErrors.length > 1 ? ` (+${result.rowErrors.length - 1} more)` : ''}
          </Alert>
        )}

        {!result || result.compileError ? (
          <EmptyState
            illustration="EmptySuitcase"
            size="lg"
            title="Run a query to see matching users"
            description={
              mode === 'builder' ? 'Add a condition above.' : 'Try one of the examples above, or write your own expression.'
            }
          />
        ) : (
          <>
            <div className="query-results-toolbar">
              <Text color="secondary" variant="body-sm-normal">
                <strong>{result.matches.length}</strong> of {result.total} user
                {result.total === 1 ? '' : 's'} match
                {includeCredentials ? ' (API Credentials included)' : ''}
              </Text>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={Download}
                onClick={exportCsv}
                disabled={result.matches.length === 0}
              >
                Export CSV
              </Button>
            </div>

            {result.matches.length === 0 ? (
              <EmptyState
                size="md"
                title="No users matched"
                description="Nothing in the current roster satisfies that expression."
              />
            ) : (
              <div className="query-table-wrapper">
                <table className="detail-table query-table">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Email</th>
                      <th scope="col">Sign-in</th>
                      <th scope="col">Status</th>
                      <th scope="col">Teams</th>
                      {LEVEL_COLUMNS.map((c) => (
                        <th scope="col" key={c.key}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.matches.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link to={r.type === 'credential' ? `/api-keys/${encodeURIComponent(r.id)}` : `/users/${encodeURIComponent(r.id)}`}>
                            {r.name}
                          </Link>
                        </td>
                        <td>
                          <Text color="secondary" variant="body-sm-normal">
                            {r.email || '—'}
                          </Text>
                        </td>
                        <td>
                          <Tag size="sm">{AUTH_LABELS[r.authKind]}</Tag>
                        </td>
                        <td>
                          {r.disabled ? (
                            <Tag color="danger" size="sm">
                              Disabled
                            </Tag>
                          ) : (
                            <Text color="secondary" variant="body-sm-normal">
                              Active
                            </Text>
                          )}
                        </td>
                        <td>
                          <span className="query-teams-cell" title={r.teams.join(', ')}>
                            {r.teams.length > 0 ? r.teams.join(', ') : '—'}
                          </span>
                        </td>
                        {LEVEL_COLUMNS.map((c) => (
                          <td key={c.key}>
                            <LevelTag value={r[c.key] as string} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
