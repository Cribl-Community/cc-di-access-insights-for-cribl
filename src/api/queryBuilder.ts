import { PRODUCTS, PRODUCT_LABELS, type Product } from './types';

/**
 * The field-based query builder: a list of conditions (field → operator →
 * value) joined by "all" or "any". It never runs anything itself — it only
 * writes a query expression, which then runs through the same
 * `compileUserQuery` as a hand-written one. So the Builder, the Expression
 * editor, and Ask all agree, and the builder's output can be opened as an
 * expression and edited.
 */

export type Scope = 'workspace' | Product;

export type Condition =
  | { id: string; field: 'team'; op: 'is' | 'isNot'; value: string }
  | { id: string; field: 'teamCount'; op: 'none' | 'some' }
  | { id: string; field: 'role'; op: 'is' | 'isNot'; value: string }
  | { id: string; field: 'access'; scope: Scope; op: 'atLeast' | 'exactly' | 'none'; value: string }
  | { id: string; field: 'admin'; op: 'org' | 'workspace' | 'any' | 'notAny' }
  | { id: string; field: 'signIn'; op: 'is' | 'isNot'; value: 'saml' | 'sso' | 'local' }
  | { id: string; field: 'status'; op: 'active' | 'disabled' }
  | { id: string; field: 'name' | 'email'; op: 'contains' | 'startsWith' | 'endsWith' | 'equals'; value: string };

export type ConditionField = Condition['field'];

export type MatchMode = 'all' | 'any';

export interface BuilderState {
  match: MatchMode;
  conditions: Condition[];
}

/** Field choices, in the order the builder lists them. */
export const BUILDER_FIELDS: Array<{ field: ConditionField; label: string }> = [
  { field: 'access', label: 'Product access' },
  { field: 'team', label: 'Team' },
  { field: 'teamCount', label: 'Team membership' },
  { field: 'role', label: 'Role' },
  { field: 'admin', label: 'Admin' },
  { field: 'signIn', label: 'Sign-in method' },
  { field: 'status', label: 'Status' },
  { field: 'name', label: 'Name' },
  { field: 'email', label: 'Email' },
];

export const SCOPE_OPTIONS: Array<{ value: Scope; label: string }> = [
  ...PRODUCTS.map((p) => ({ value: p as Scope, label: PRODUCT_LABELS[p] })),
  { value: 'workspace', label: 'Workspace' },
];

/** Levels offered for "at least" / "exactly", strongest first — the order `levelRank` uses. */
export const BUILDER_LEVELS = ['Admin', 'Editor', 'Read Only', 'User'] as const;

export const SIGN_IN_OPTIONS = [
  { value: 'saml', label: 'SAML SSO' },
  { value: 'sso', label: 'SSO (OIDC)' },
  { value: 'local', label: 'Local' },
] as const;

let seq = 0;
const nextId = () => `c${++seq}`;

/** A new condition for `field`, with sensible defaults. `teams` / `roles` seed the first choice. */
export function newCondition(field: ConditionField, teams: string[] = [], roles: string[] = []): Condition {
  const id = nextId();
  switch (field) {
    case 'team':
      return { id, field, op: 'is', value: teams[0] ?? '' };
    case 'teamCount':
      return { id, field, op: 'none' };
    case 'role':
      return { id, field, op: 'is', value: roles[0] ?? '' };
    case 'access':
      return { id, field, scope: 'stream', op: 'atLeast', value: 'Editor' };
    case 'admin':
      return { id, field, op: 'any' };
    case 'signIn':
      return { id, field, op: 'is', value: 'local' };
    case 'status':
      return { id, field, op: 'disabled' };
    case 'name':
    case 'email':
      return { id, field, op: 'contains', value: '' };
  }
}

/** A JS single-quoted string literal for `value`. */
function str(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function levelField(scope: Scope): string {
  return scope === 'workspace' ? 'workspaceLevel' : scope;
}

/** The expression for one condition, or null while it's incomplete (e.g. an empty name). */
export function conditionToExpression(c: Condition): string | null {
  switch (c.field) {
    case 'team':
      if (!c.value) return null;
      return `${c.op === 'isNot' ? '!' : ''}hasTeam(${str(c.value)})`;
    case 'teamCount':
      return c.op === 'none' ? 'teams.length === 0' : 'teams.length > 0';
    case 'role':
      if (!c.value) return null;
      return `${c.op === 'isNot' ? '!' : ''}hasRole(${str(c.value)})`;
    case 'access': {
      if (c.op === 'none') {
        return `${levelField(c.scope)} === ${str(c.scope === 'workspace' ? 'None' : 'No Access')}`;
      }
      if (!c.value) return null;
      return c.op === 'atLeast'
        ? `atLeast(${str(c.scope)}, ${str(c.value.toLowerCase())})`
        : `${levelField(c.scope)} === ${str(c.value)}`;
    }
    case 'admin':
      return { org: 'isOrgAdmin', workspace: 'isWorkspaceAdmin', any: 'isAnyAdmin', notAny: '!isAnyAdmin' }[c.op];
    case 'signIn':
      return `authKind ${c.op === 'is' ? '===' : '!=='} ${str(c.value)}`;
    case 'status':
      return c.op === 'disabled' ? 'disabled' : '!disabled';
    case 'name':
    case 'email': {
      const v = c.value.trim();
      if (!v) return null;
      // includes / startsWith / endsWith ignore case while a query runs; "equals" compares lower-cased.
      return c.op === 'equals'
        ? `${c.field}.toLowerCase() === ${str(v.toLowerCase())}`
        : `${c.field}.${c.op === 'contains' ? 'includes' : c.op}(${str(v)})`;
    }
  }
}

/** The whole builder as one expression ('' when there's nothing complete to run). */
export function builderToExpression(state: BuilderState): string {
  const parts = state.conditions.map(conditionToExpression).filter((p): p is string => Boolean(p));
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const joiner = state.match === 'all' ? ' && ' : ' || ';
  return parts.map((p) => (/\s(&&|\|\|)\s/.test(p) ? `(${p})` : p)).join(joiner);
}
