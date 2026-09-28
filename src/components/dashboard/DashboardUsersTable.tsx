import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilterOutlined, SearchOutlined } from '@capra/icons';
import { describeAuth } from '../../api/overview';
import { PRODUCT_LABELS } from '../../api/types';
import { initials } from '../../lib/initials';
import type { DashboardRow } from '../../viz/dashboard';
import { LEVEL_BUCKET_BY_KEY, levelBucket } from '../../viz/levels';
import { CardMenu } from './CardMenu';
import './dashboard.css';
import './DashboardUsersTable.css';

type RowFilter = 'all' | 'admins' | 'sso' | 'local' | 'disabled' | 'no-team';

const FILTERS: Array<{ key: RowFilter; label: string; match: (r: DashboardRow) => boolean }> = [
  { key: 'all', label: 'All users', match: () => true },
  { key: 'admins', label: 'Admins', match: (r) => Boolean(r.adminLabel) },
  { key: 'sso', label: 'SSO', match: (r) => r.auth === 'saml' || r.auth === 'sso' },
  { key: 'local', label: 'Local sign-in', match: (r) => r.auth === 'local' },
  { key: 'disabled', label: 'Disabled', match: (r) => Boolean(r.user.disabled) },
  { key: 'no-team', label: 'In no team', match: (r) => r.access.teams.length === 0 },
];

const MAX_ROWS = 8;

/** "All users" panel: search + filter + the most-privileged users first, with row actions. */
export function DashboardUsersTable({ rows }: { rows: DashboardRow[] }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RowFilter>('all');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = FILTERS.find((f) => f.key === filter)!.match;
    return rows
      .filter(match)
      .filter((r) => !q || [r.name, r.user.email, r.user.username].some((f) => f?.toLowerCase().includes(q)))
      .sort(
        (a, b) =>
          Number(Boolean(b.adminLabel)) - Number(Boolean(a.adminLabel)) ||
          b.highest.rank - a.highest.rank ||
          a.name.localeCompare(b.name),
      );
  }, [rows, query, filter]);

  const shown = visible.slice(0, MAX_ROWS);

  return (
    <section className="dash-section glass-card" aria-labelledby="dash-users-title">
      <header className="dash-section-header dash-table-header">
        <h2 id="dash-users-title">All users</h2>
        <div className="dash-table-tools">
          <label className="dash-mini-search">
            <SearchOutlined size="sm" aria-hidden />
            <input
              type="search"
              value={query}
              placeholder="Search"
              aria-label="Search users"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="dash-filter" title="Filter">
            <FilterOutlined size="sm" aria-hidden />
            <select value={filter} aria-label="Filter users" onChange={(e) => setFilter(e.target.value as RowFilter)}>
              {FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <Link to="/users" className="dash-see-all">
            See all
          </Link>
        </div>
      </header>

      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Sign-in</th>
              <th scope="col">Teams</th>
              <th scope="col">Highest access</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="dash-table-empty">
                  No users match.
                </td>
              </tr>
            )}
            {shown.map((r) => {
              const bucket = r.adminLabel ? 'admin' : levelBucket(r.highest.level);
              const levelText = r.adminLabel
                ? r.adminLabel
                : r.highest.product
                  ? `${r.highest.level} · ${PRODUCT_LABELS[r.highest.product]}`
                  : 'No Access';
              const teamNames = r.access.teams.map((t) => t.name);
              return (
                <tr key={r.user.id} onClick={() => navigate(`/users/${encodeURIComponent(r.user.id)}`)}>
                  <td>
                    <span className="dash-user">
                      <span className="dash-avatar" aria-hidden>
                        {initials(r.name)}
                      </span>
                      <span className="dash-user-text">
                        <Link
                          to={`/users/${encodeURIComponent(r.user.id)}`}
                          className="dash-user-name"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.name}
                        </Link>
                        <span className="dash-user-sub">{r.user.email || r.user.username}</span>
                      </span>
                    </span>
                  </td>
                  <td className="dash-muted">{describeAuth(r.user).label}</td>
                  <td className="dash-muted" title={teamNames.join(', ')}>
                    {teamNames.length === 0
                      ? '—'
                      : teamNames.length <= 2
                        ? teamNames.join(', ')
                        : `${teamNames.slice(0, 2).join(', ')} +${teamNames.length - 2}`}
                  </td>
                  <td>
                    <span className="dash-level">
                      <span className="lsb-swatch" style={{ background: LEVEL_BUCKET_BY_KEY[bucket].cssVar }} aria-hidden />
                      {levelText}
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill ${r.user.disabled ? 'status-pill-danger' : 'status-pill-success'}`}>
                      {r.user.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <CardMenu
                      label={`Actions for ${r.name}`}
                      items={[
                        { label: 'Open access graph', onSelect: () => navigate(`/users/${encodeURIComponent(r.user.id)}?view=graph`) },
                        { label: 'Compare with…', onSelect: () => navigate(`/access-check?a=${encodeURIComponent(r.user.id)}`) },
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible.length > MAX_ROWS && (
        <p className="dash-table-foot">
          Showing {MAX_ROWS} of {visible.length} — <Link to="/users">see all in Directory</Link>
        </p>
      )}
    </section>
  );
}
