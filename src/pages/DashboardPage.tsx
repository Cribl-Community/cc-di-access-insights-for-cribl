import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Skeleton } from '@capra/core';
import { Download, GroupOutlined, SecurityScan, UsersOutlined, WarningOutlined } from '@capra/icons';
import { useRbacData } from '../context/RbacDataContext';
import { TEAM_FILTERS, computeOverviewStats } from '../api/overview';
import { buildQueryRecord, downloadCsv, usersToCsv } from '../api/query';
import { PRODUCT_LABELS, type Product } from '../api/types';
import { kvGet, kvSet } from '../api/kv';
import { buildDashboardModel, type DashboardModel } from '../viz/dashboard';
import type { LevelBucket } from '../viz/levels';
import { PageHeader } from '../components/shell/PageHeader';
import { ProductIcon } from '../components/shell/ProductIcon';
import { KpiCard } from '../components/dashboard/KpiCard';
import { RingMeter } from '../components/dashboard/RingMeter';
import { LevelStackBar } from '../components/dashboard/LevelStackBar';
import { OverviewSettings } from '../components/OverviewSettings';
import { DashboardUsersTable } from '../components/dashboard/DashboardUsersTable';
import './DashboardPage.css';
import './Page.css';

const CARDS = [
  { key: 'users', label: 'Users', section: 'Summary' },
  { key: 'teams', label: 'Teams', section: 'Summary' },
  { key: 'admins', label: 'Admins', section: 'Summary' },
  { key: 'attention', label: 'Needs attention', section: 'Summary' },
  { key: 'products', label: 'Access by product', section: 'Sections' },
  { key: 'table', label: 'All users', section: 'Sections' },
];

const HIDDEN_KEY = 'dashboard/hiddenCards';

const LEVEL_EXPR: Record<LevelBucket, string> = {
  admin: "=== 'Admin'",
  editor: "=== 'Editor'",
  read: "=== 'Read Only'",
  user: "=== 'User'",
  none: "=== 'No Access'",
  other: '',
};

function levelQuery(product: Product, bucket: LevelBucket): string {
  const lhs = `access('${product}')`;
  return bucket === 'other'
    ? `!['Admin', 'Editor', 'Read Only', 'User', 'No Access'].includes(${lhs})`
    : `${lhs} ${LEVEL_EXPR[bucket]}`;
}

function pct(n: number, d: number): number {
  return d ? Math.round((n / d) * 100) : 0;
}

function useHiddenCards() {
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    kvGet<string[]>(HIDDEN_KEY, []).then((v) => {
      if (!cancelled && Array.isArray(v)) setHidden(v.filter((k) => typeof k === 'string'));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const update = (next: string[]) => {
    setHidden(next);
    void kvSet(HIDDEN_KEY, next);
  };
  return { hidden: new Set(hidden), update, list: hidden };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { loading, error, users, teams, roles, groups, resolveUserAccess, resolveTeamAccess } = useRbacData();
  const { hidden, update, list } = useHiddenCards();

  const stats = useMemo(
    () => computeOverviewStats({ users, teams, roles, groups, resolveUserAccess, resolveTeamAccess }),
    [users, teams, roles, groups, resolveUserAccess, resolveTeamAccess],
  );
  const model: DashboardModel = useMemo(
    () =>
      buildDashboardModel(users, teams, resolveUserAccess, (t) => TEAM_FILTERS.empty.match(t, resolveTeamAccess)),
    [users, teams, resolveUserAccess, resolveTeamAccess],
  );

  const toggle = (key: string) => update(hidden.has(key) ? list.filter((k) => k !== key) : [...list, key]);

  const exportAll = () => {
    const records = model.rows.map((r) => buildQueryRecord(r.user, r.access));
    downloadCsv(`access-insights-users-${new Date().toISOString().slice(0, 10)}.csv`, usersToCsv(records));
  };

  if (loading) {
    return (
      <div className="page-status">
        <Skeleton active paragraph={{ rows: 8 }} />
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

  const adminCount = model.admins.length;
  const showSummary = ['users', 'teams', 'admins', 'attention'].some((k) => !hidden.has(k));

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Members, Teams, and Permissions across your Organization."
        actions={
          <>
            <OverviewSettings
              tiles={CARDS}
              hidden={hidden}
              onToggle={toggle}
              onShowAll={() => update([])}
            />
            <Button variant="secondary" leadingIcon={Download} onClick={exportAll} disabled={model.rows.length === 0}>
              Export
            </Button>
            <Button variant="primary" onClick={() => navigate('/access-check')}>
              Check access
            </Button>
          </>
        }
      />

      {showSummary && (
        <div className="kpi-grid">
          {!hidden.has('users') && (
            <KpiCard
              icon={UsersOutlined}
              label="Users"
              value={stats.totalUsers}
              chip={
                stats.authUnknown
                  ? { text: 'Sign-in method unknown', tone: 'neutral' }
                  : { text: `${model.ssoPct}% SSO`, tone: 'brand' }
              }
              caption={stats.disabledUsers ? `${stats.disabledUsers} disabled` : 'all active'}
              to="/users"
            />
          )}
          {!hidden.has('teams') && (
            <KpiCard
              icon={GroupOutlined}
              label="Teams"
              value={stats.totalTeams}
              chip={
                stats.emptyTeams
                  ? { text: `${stats.emptyTeams} empty`, tone: 'warning' }
                  : { text: 'all staffed', tone: 'success' }
              }
              caption={stats.idpMappedTeams ? `${stats.idpMappedTeams} IdP-mapped` : undefined}
              to="/teams"
            />
          )}
          {!hidden.has('admins') && (
            <KpiCard
              icon={SecurityScan}
              label="Admins"
              value={adminCount}
              chip={{ text: `${pct(adminCount, stats.totalUsers)}% of users`, tone: adminCount ? 'brand' : 'neutral' }}
              caption={`${stats.orgAdmins} org · ${stats.workspaceAdmins} workspace`}
              to={`/query?q=${encodeURIComponent('isOrgAdmin || isWorkspaceAdmin')}`}
            />
          )}
          {!hidden.has('attention') && (
            <KpiCard
              icon={WarningOutlined}
              label="Needs attention"
              value={model.attentionTotal}
              chip={
                model.attentionTotal
                  ? { text: `${model.attention.filter((a) => a.count).length} finding types`, tone: 'warning' }
                  : { text: 'nothing flagged', tone: 'success' }
              }
            >
              <ul className="kpi-findings">
                {model.attention.map((a) => (
                  <li key={a.key}>
                    <Link to={a.to} className={`kpi-finding${a.count ? '' : ' kpi-finding-zero'}`}>
                      <span>{a.label}</span>
                      <strong>{a.count}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            </KpiCard>
          )}
        </div>
      )}

      {!hidden.has('products') && (
        <section className="dash-section glass-card" aria-labelledby="dash-products-title">
          <header className="dash-section-header">
            <h2 id="dash-products-title">Access by product</h2>
            <span className="dash-section-hint">Share of users with any access, and at which level</span>
            <Link to="/worker-groups" className="dash-see-all dash-section-link">
              Look up a Worker Group
            </Link>
          </header>
          <div className="product-grid">
            {model.products.map((p) => (
              <article key={p.product} className="product-card">
                <header className="product-card-header">
                  <ProductIcon product={p.product} size="md" />
                  <span className="product-card-name">Cribl {PRODUCT_LABELS[p.product]}</span>
                </header>
                <div className="product-card-body">
                  <div className="product-card-figure">
                    <span className="product-card-value">{p.withAccess}</span>
                    <span className="product-card-unit">users with access</span>
                    <span className="product-card-sub">of {p.total}</span>
                  </div>
                  <RingMeter value={p.total ? p.withAccess / p.total : 0} caption="have access" size={80} />
                </div>
                <LevelStackBar
                  counts={p.counts}
                  total={p.total}
                  includeNone={false}
                  onSelect={(b) => navigate(`/query?q=${encodeURIComponent(levelQuery(p.product, b))}`)}
                />
              </article>
            ))}
          </div>
        </section>
      )}

      {!hidden.has('table') && <DashboardUsersTable rows={model.rows} />}
    </div>
  );
}
