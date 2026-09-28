import { PRODUCTS, type Product, type User, type UserAccess } from './types';
import { computeProductAccess, levelRank } from './productAccess';
import { resolveGroupAdminReach } from './access';
import { classifyAuth, type AuthKind } from './overview';

/**
 * One user flattened into the plain fields and arrays a query expression can
 * read. Every level is always a string ("No Access" at minimum, "None" for
 * Workspace) so an expression never has to guard against `null`/`undefined`.
 */
export interface UserQueryRecord {
  id: string;
  name: string;
  email: string;
  username: string;
  disabled: boolean;
  type: 'user' | 'credential';
  authKind: AuthKind;
  isOrgAdmin: boolean;
  isWorkspaceAdmin: boolean;
  /** True for an org admin, a Workspace admin, or an Admin on any one product. */
  isAnyAdmin: boolean;
  /** Team names this user belongs to. */
  teams: string[];
  /** Team ids this user belongs to (same order as `teams`). */
  teamIds: string[];
  /** Effective role titles (falls back to the role id when untitled). */
  roles: string[];
  /** Effective role ids (same order as `roles`). */
  roleIds: string[];
  workspaceLevel: string;
  stream: string;
  edge: string;
  search: string;
  lake: string;
  outpost: string;
}

/** Field names in `UserQueryRecord`, in the exact order passed into the compiled expression. */
const FIELD_NAMES = [
  'id',
  'name',
  'email',
  'username',
  'disabled',
  'type',
  'authKind',
  'isOrgAdmin',
  'isWorkspaceAdmin',
  'isAnyAdmin',
  'teams',
  'teamIds',
  'roles',
  'roleIds',
  'workspaceLevel',
  'stream',
  'edge',
  'search',
  'lake',
  'outpost',
] as const satisfies readonly (keyof UserQueryRecord)[];

const HELPER_NAMES = ['hasTeam', 'hasRole', 'access', 'atLeast'] as const;

// --- Language metadata for the editor's autocomplete -------------------------
// (compiling doesn't need any of this — it's what `JsExpressionEditor` offers
// as suggestions while typing.)

/** Every top-level field name, for identifier-position completions. */
export const QUERY_FIELD_NAMES: readonly string[] = FIELD_NAMES;
/** Every helper function name, for identifier-position completions. */
export const QUERY_HELPER_NAMES: readonly string[] = HELPER_NAMES;

/** Fields that are always a string — offered for `.method()` completion after a `.`. */
export const QUERY_STRING_FIELDS = [
  'id',
  'name',
  'email',
  'username',
  'authKind',
  'workspaceLevel',
  'stream',
  'edge',
  'search',
  'lake',
  'outpost',
] as const satisfies readonly (keyof UserQueryRecord)[];

/** Fields that are always an array — offered for `.method()` completion after a `.`. */
export const QUERY_ARRAY_FIELDS = ['teams', 'teamIds', 'roles', 'roleIds'] as const satisfies readonly (
  keyof UserQueryRecord
)[];

/** Valid first argument to `access()` / `atLeast()` — the same scopes `scopeLevel` accepts below. */
export const QUERY_PRODUCT_SCOPES = ['workspace', ...PRODUCTS] as const;

/** Level names `atLeast()`'s second argument accepts, strongest first. */
export const QUERY_LEVEL_NAMES = ['Admin', 'Editor', 'Collect', 'User', 'Read Only', 'No Access'] as const;

function userName(user: User): string {
  return [user.first, user.last].filter(Boolean).join(' ') || user.username || user.id;
}

/** Build the flat query record for one user from their already-resolved access. */
export function buildQueryRecord(user: User, access: UserAccess): UserQueryRecord {
  const { isOrgAdmin, levels } = computeProductAccess(user, access.effectiveRoles);
  const isWorkspaceAdmin = resolveGroupAdminReach(user, access.effectiveRoles).some(
    (g) => g.scope === 'workspace',
  );
  const productLevel = (p: Product) => levels[p] ?? 'No Access';
  const isAnyAdmin =
    isOrgAdmin || isWorkspaceAdmin || PRODUCTS.some((p) => productLevel(p) === 'Admin');

  return {
    id: user.id,
    name: userName(user),
    email: user.email ?? '',
    username: user.username ?? '',
    disabled: Boolean(user.disabled),
    type: user.type === 'credential' ? 'credential' : 'user',
    authKind: classifyAuth(user),
    isOrgAdmin,
    isWorkspaceAdmin,
    isAnyAdmin,
    teams: access.teams.map((t) => t.name),
    teamIds: access.teams.map((t) => t.id),
    roles: access.effectiveRoles.map((r) => r.role.title || r.role.id),
    roleIds: access.effectiveRoles.map((r) => r.role.id),
    workspaceLevel: levels.workspace ?? 'None',
    stream: productLevel('stream'),
    edge: productLevel('edge'),
    search: productLevel('search'),
    lake: productLevel('lake'),
    outpost: productLevel('outpost'),
  };
}

function isProduct(value: string): value is Product {
  return (PRODUCTS as readonly string[]).includes(value);
}

function scopeLevel(record: UserQueryRecord, scope: string): string {
  const key = scope.trim().toLowerCase();
  if (key === 'workspace') return record.workspaceLevel;
  if (isProduct(key)) return record[key];
  throw new Error(`Unknown scope "${scope}" — use workspace, stream, edge, search, lake, or outpost.`);
}

function makeHasTeam(record: UserQueryRecord) {
  return (value: string): boolean => {
    const needle = String(value).trim().toLowerCase();
    return (
      record.teams.some((t) => t.toLowerCase() === needle) ||
      record.teamIds.some((t) => t.toLowerCase() === needle)
    );
  };
}

function makeHasRole(record: UserQueryRecord) {
  return (value: string): boolean => {
    const needle = String(value).trim().toLowerCase();
    return (
      record.roles.some((r) => r.toLowerCase() === needle) ||
      record.roleIds.some((r) => r.toLowerCase() === needle)
    );
  };
}

function makeAccess(record: UserQueryRecord) {
  return (scope: string): string => scopeLevel(record, scope);
}

function makeAtLeast(record: UserQueryRecord) {
  return (scope: string, level: string): boolean => levelRank(scopeLevel(record, scope)) >= levelRank(level);
}

export interface CompiledUserQuery {
  test: (record: UserQueryRecord) => boolean;
}

/**
 * The four String methods someone would naturally reach for to search free-text
 * fields (`name`, `email`, …). Query expressions are otherwise exact JS — `===`
 * stays exact, which matters for the enum-like fields (`authKind`, level
 * strings) — but a *search* shouldn't force the user to match the record's
 * exact casing, so these four are case-folded on both sides while a query runs.
 */
const CASE_INSENSITIVE_STRING_METHODS = ['includes', 'startsWith', 'endsWith', 'indexOf'] as const;

type PatchableStringMethod = (typeof CASE_INSENSITIVE_STRING_METHODS)[number];
type NativeStringMethod = (this: string, search: unknown, position?: number) => unknown;

/**
 * Temporarily patches `String.prototype`'s search methods to be
 * case-insensitive for the duration of `fn`, then restores them — always,
 * even if `fn` throws. Safe because `fn` runs entirely synchronously (a plain
 * loop over already-loaded records, no timers/promises), so nothing else can
 * observe `String.prototype` mid-patch.
 */
function withCaseInsensitiveSearch<T>(fn: () => T): T {
  const proto = String.prototype as unknown as Record<PatchableStringMethod, NativeStringMethod>;
  const originals = CASE_INSENSITIVE_STRING_METHODS.map((name) => proto[name]);
  CASE_INSENSITIVE_STRING_METHODS.forEach((name, i) => {
    const original = originals[i];
    // eslint-disable-next-line no-extend-native -- deliberate, scoped, and reverted in `finally` below.
    proto[name] = function (this: string, search: unknown, position?: number) {
      return original.call(this.toLowerCase(), String(search).toLowerCase(), position);
    };
  });
  try {
    return fn();
  } finally {
    CASE_INSENSITIVE_STRING_METHODS.forEach((name, i) => {
      proto[name] = originals[i];
    });
  }
}

/**
 * Compile a JS boolean expression against a `UserQueryRecord` — the same
 * "type an expression, it runs per record" pattern used by Filter fields
 * throughout Cribl's own UI (Routes, QuickConnect, Notifications, …). Every
 * field of `UserQueryRecord` is in scope by its bare name, plus four helpers:
 * `hasTeam(name)`, `hasRole(name)`, `access(scope)`, `atLeast(scope, level)`.
 *
 * Runs entirely in the browser against data this app already holds — nothing
 * is sent anywhere, and the expression only ever sees the fields/helpers
 * listed above. Throws with a readable message when the expression doesn't
 * parse.
 */
export function compileUserQuery(expression: string): CompiledUserQuery {
  const trimmed = expression.trim();
  if (!trimmed) throw new Error('Enter an expression — e.g. isOrgAdmin');

  let fn: (...args: unknown[]) => unknown;
  try {
    // eslint-disable-next-line no-new-func -- deliberate: mirrors Cribl's own Filter-field expressions.
    fn = new Function(
      ...FIELD_NAMES,
      ...HELPER_NAMES,
      `"use strict";\nreturn (\n${trimmed}\n);`,
    ) as (...args: unknown[]) => unknown;
  } catch (err) {
    throw new Error(`Couldn't parse that expression — ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    test(record) {
      const fieldValues = FIELD_NAMES.map((name) => record[name]);
      const helpers = [makeHasTeam(record), makeHasRole(record), makeAccess(record), makeAtLeast(record)];
      return Boolean(fn(...fieldValues, ...helpers));
    },
  };
}

export interface UserQueryResult {
  matches: UserQueryRecord[];
  /** One message per record whose expression threw, deduped by message. */
  errors: string[];
  /** Total records the query ran against (before filtering). */
  total: number;
}

/** Run a compiled query over every record, tolerating (and collecting) per-record evaluation errors. */
export function runUserQuery(compiled: CompiledUserQuery, records: UserQueryRecord[]): UserQueryResult {
  return withCaseInsensitiveSearch(() => {
    const matches: UserQueryRecord[] = [];
    const errorMessages = new Set<string>();
    for (const record of records) {
      try {
        if (compiled.test(record)) matches.push(record);
      } catch (err) {
        errorMessages.add(err instanceof Error ? err.message : String(err));
      }
    }
    return { matches, errors: [...errorMessages], total: records.length };
  });
}

export interface QueryExample {
  label: string;
  expression: string;
  /** True when the expression contains a placeholder the user must edit before running (e.g. a team name). */
  isTemplate?: boolean;
}

/** Starter queries shown as clickable chips — the two from the feature request, plus a few common review queries. */
export const QUERY_EXAMPLES: QueryExample[] = [
  { label: 'Organization admins', expression: 'isOrgAdmin' },
  { label: 'Any kind of admin', expression: 'isAnyAdmin' },
  { label: 'SSO users', expression: "authKind === 'saml' || authKind === 'sso'" },
  { label: 'Disabled accounts', expression: 'disabled' },
  { label: 'Users in no team', expression: 'teams.length === 0' },
  {
    label: 'On a team + can access a product',
    expression: "hasTeam('Platform') && atLeast('stream', 'user')",
    isTemplate: true,
  },
  {
    label: 'Admin on one product, not on a team',
    expression: "access('search') === 'Admin' && !hasTeam('Data Governance')",
    isTemplate: true,
  },
];

const CSV_HEADERS = [
  'Name',
  'Email',
  'Username',
  'Disabled',
  'Sign-in',
  'Org Admin',
  'Workspace Admin',
  'Workspace',
  'Stream',
  'Edge',
  'Search',
  'Lake',
  'Outpost',
  'Teams',
  'Roles',
];

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvRow(record: UserQueryRecord): string {
  return [
    record.name,
    record.email,
    record.username,
    record.disabled ? 'Yes' : 'No',
    record.authKind,
    record.isOrgAdmin ? 'Yes' : 'No',
    record.isWorkspaceAdmin ? 'Yes' : 'No',
    record.workspaceLevel,
    record.stream,
    record.edge,
    record.search,
    record.lake,
    record.outpost,
    record.teams.join('; '),
    record.roles.join('; '),
  ]
    .map((v) => csvCell(String(v)))
    .join(',');
}

/** Serialize matched records to CSV (CRLF line endings, RFC 4180 quoting). */
export function usersToCsv(records: UserQueryRecord[]): string {
  return [CSV_HEADERS.join(','), ...records.map(csvRow)].join('\r\n') + '\r\n';
}

/** Trigger a browser download of a CSV string. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
