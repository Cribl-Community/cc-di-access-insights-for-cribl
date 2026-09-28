import { CloseOutlined, Plus } from '@capra/icons';
import {
  BUILDER_FIELDS,
  BUILDER_LEVELS,
  SCOPE_OPTIONS,
  SIGN_IN_OPTIONS,
  builderToExpression,
  newCondition,
  type BuilderState,
  type Condition,
  type ConditionField,
} from '../../api/queryBuilder';
import './QueryModes.css';

interface Props {
  state: BuilderState;
  onChange: (next: BuilderState) => void;
  teamNames: string[];
  roleNames: string[];
  /** Open the generated expression in the Expression editor. */
  onEditAsExpression: (expression: string) => void;
}

function Select<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <select className="qb-select" value={value} aria-label={label} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const names = (list: string[]) => list.map((n) => ({ value: n, label: n }));

/** The operator + value controls for one condition. */
function ConditionControls({
  c,
  set,
  teamNames,
  roleNames,
}: {
  c: Condition;
  set: (next: Condition) => void;
  teamNames: string[];
  roleNames: string[];
}) {
  switch (c.field) {
    case 'team':
    case 'role': {
      const list = c.field === 'team' ? teamNames : roleNames;
      return (
        <>
          <Select
            label="Operator"
            value={c.op}
            onChange={(op) => set({ ...c, op })}
            options={[
              { value: 'is', label: c.field === 'team' ? 'is a member of' : 'has' },
              { value: 'isNot', label: c.field === 'team' ? 'is not a member of' : "doesn't have" },
            ]}
          />
          {list.length === 0 ? (
            <span className="qb-empty">No {c.field === 'team' ? 'Teams' : 'roles'} found</span>
          ) : (
            <Select label={c.field === 'team' ? 'Team' : 'Role'} value={c.value} onChange={(value) => set({ ...c, value })} options={names(list)} />
          )}
        </>
      );
    }
    case 'teamCount':
      return (
        <Select
          label="Operator"
          value={c.op}
          onChange={(op) => set({ ...c, op })}
          options={[
            { value: 'none', label: 'is in no Team' },
            { value: 'some', label: 'is in at least one Team' },
          ]}
        />
      );
    case 'access':
      return (
        <>
          <Select label="Product" value={c.scope} onChange={(scope) => set({ ...c, scope })} options={SCOPE_OPTIONS} />
          <Select
            label="Operator"
            value={c.op}
            onChange={(op) => set({ ...c, op })}
            options={[
              { value: 'atLeast', label: 'is at least' },
              { value: 'exactly', label: 'is exactly' },
              { value: 'none', label: 'has no access' },
            ]}
          />
          {c.op !== 'none' && (
            <Select label="Level" value={c.value} onChange={(value) => set({ ...c, value })} options={names([...BUILDER_LEVELS])} />
          )}
        </>
      );
    case 'admin':
      return (
        <Select
          label="Operator"
          value={c.op}
          onChange={(op) => set({ ...c, op })}
          options={[
            { value: 'any', label: 'is an admin (any level)' },
            { value: 'org', label: 'is an Organization admin' },
            { value: 'workspace', label: 'is a Workspace admin' },
            { value: 'notAny', label: 'is not an admin' },
          ]}
        />
      );
    case 'signIn':
      return (
        <>
          <Select
            label="Operator"
            value={c.op}
            onChange={(op) => set({ ...c, op })}
            options={[
              { value: 'is', label: 'is' },
              { value: 'isNot', label: 'is not' },
            ]}
          />
          <Select label="Sign-in method" value={c.value} onChange={(value) => set({ ...c, value })} options={SIGN_IN_OPTIONS} />
        </>
      );
    case 'status':
      return (
        <Select
          label="Status"
          value={c.op}
          onChange={(op) => set({ ...c, op })}
          options={[
            { value: 'disabled', label: 'is disabled' },
            { value: 'active', label: 'is active' },
          ]}
        />
      );
    case 'name':
    case 'email':
      return (
        <>
          <Select
            label="Operator"
            value={c.op}
            onChange={(op) => set({ ...c, op })}
            options={[
              { value: 'contains', label: 'contains' },
              { value: 'startsWith', label: 'starts with' },
              { value: 'endsWith', label: 'ends with' },
              { value: 'equals', label: 'is' },
            ]}
          />
          <input
            className="qb-input"
            value={c.value}
            placeholder={c.field === 'email' ? '@example.com' : 'text'}
            aria-label={c.field === 'email' ? 'Email text' : 'Name text'}
            onChange={(e) => set({ ...c, value: e.target.value })}
          />
        </>
      );
  }
}

/** Field-based query builder: no expression syntax needed. */
export function QueryBuilderPanel({ state, onChange, teamNames, roleNames, onEditAsExpression }: Props) {
  const expression = builderToExpression(state);

  const update = (id: string, next: Condition) =>
    onChange({ ...state, conditions: state.conditions.map((c) => (c.id === id ? next : c)) });
  const remove = (id: string) => onChange({ ...state, conditions: state.conditions.filter((c) => c.id !== id) });
  const add = () => onChange({ ...state, conditions: [...state.conditions, newCondition('access', teamNames, roleNames)] });
  const changeField = (c: Condition, field: ConditionField) => {
    const fresh = newCondition(field, teamNames, roleNames);
    update(c.id, { ...fresh, id: c.id } as Condition);
  };

  return (
    <div className="qb">
      <div className="qb-match">
        <span>Find accounts that match</span>
        <Select
          label="Match"
          value={state.match}
          onChange={(match) => onChange({ ...state, match })}
          options={[
            { value: 'all', label: 'all' },
            { value: 'any', label: 'any' },
          ]}
        />
        <span>of these conditions:</span>
      </div>

      <ul className="qb-rows">
        {state.conditions.map((c, i) => (
          <li key={c.id} className="qb-row">
            <span className="qb-joiner" aria-hidden>
              {i === 0 ? 'Where' : state.match === 'all' ? 'and' : 'or'}
            </span>
            <Select
              label="Field"
              value={c.field}
              onChange={(f) => changeField(c, f)}
              options={BUILDER_FIELDS.map((f) => ({ value: f.field, label: f.label }))}
            />
            <ConditionControls c={c} set={(next) => update(c.id, next)} teamNames={teamNames} roleNames={roleNames} />
            <button type="button" className="qb-remove" onClick={() => remove(c.id)} aria-label="Remove condition" title="Remove condition">
              <CloseOutlined size="sm" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="qb-add" onClick={add}>
        <Plus size="sm" aria-hidden /> Add condition
      </button>

      <div className="qb-generated">
        <span className="qb-generated-label">Expression</span>
        <code>{expression || '—'}</code>
        {expression && (
          <button type="button" className="qm-link" onClick={() => onEditAsExpression(expression)}>
            Edit as expression
          </button>
        )}
      </div>
    </div>
  );
}
