import { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ApiOutlined, GroupOutlined, UserOutlined, type SvgIcon } from '@capra/icons';
import { useRbacData } from '../../context/RbacDataContext';
import { classifyAuth } from '../../api/overview';
import { PageHeader } from './PageHeader';
import './DirectoryLayout.css';

interface Segment {
  to: string;
  label: string;
  icon: SvgIcon;
  count: number;
}

/** Directory: one page, a segmented control switching the list between Users / Teams / API Keys. */
export function DirectoryLayout() {
  const { pathname } = useLocation();
  const { users, teams, loading } = useRbacData();
  // Once a principal is open, give its graph the room the intro line would take.
  const hasSelection = /^\/(users|teams|api-keys)\/[^/]+/.test(pathname);

  const segments = useMemo<Segment[]>(() => {
    const keys = users.filter((u) => classifyAuth(u) === 'credential').length;
    return [
      { to: '/users', label: 'Users', icon: UserOutlined, count: users.length - keys },
      { to: '/teams', label: 'Teams', icon: GroupOutlined, count: teams.length },
      { to: '/api-keys', label: 'API Keys', icon: ApiOutlined, count: keys },
    ];
  }, [users, teams]);

  const nav = (
    <nav className="segmented" aria-label="Directory sections">
      {segments.map((s) => {
        const Icon = s.icon;
        const active = pathname.startsWith(s.to);
        return (
          <NavLink
            key={s.to}
            to={s.to}
            className={`segmented-item${active ? ' segmented-item-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size="sm" aria-hidden />
            <span>{s.label}</span>
            {!loading && <span className="segmented-count">{s.count}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="directory-page">
      {/* With a principal open, the switch moves beside the title to leave the graph more height. */}
      <div className={`directory-header${hasSelection ? ' directory-header-compact' : ''}`}>
        {hasSelection ? (
          <PageHeader title="Directory" actions={nav} />
        ) : (
          <PageHeader
            title="Directory"
            subtitle="Every principal in your Cribl organization — pick one to see exactly what it can reach, and why."
          >
            {nav}
          </PageHeader>
        )}
      </div>
      <div className="directory-body glass-card">
        <Outlet />
      </div>
    </div>
  );
}
