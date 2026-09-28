import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BranchesOutlined,
  ChevronLeft,
  ChevronRight,
  ClockOutlined,
  DashboardOutlined,
  HelpOutlined,
  FilterOutlined,
  UsersOutlined,
  type SvgIcon,
} from '@capra/icons';
import { useRbacData } from '../../context/RbacDataContext';
import diMark from '../../assets/brand/discovered-intelligence-mark.png';
import './AppSidebar.css';

interface NavItem {
  to: string;
  label: string;
  icon: SvgIcon;
  /** Path prefixes that make this item active (old routes are kept as aliases). */
  match: string[];
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardOutlined, match: ['/dashboard'] },
  { to: '/users', label: 'Directory', icon: UsersOutlined, match: ['/users', '/teams', '/api-keys'] },
  { to: '/access-check', label: 'Access Check', icon: BranchesOutlined, match: ['/access-check', '/compare'] },
  { to: '/query', label: 'Query', icon: FilterOutlined, match: ['/query', '/query-search'] },
];

/** Tracks when RBAC data last finished loading, from the context's loading/refreshing flags. */
function useLoadedAt(): Date | null {
  const { loading, refreshing } = useRbacData();
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const busy = loading || refreshing;
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy) setLoadedAt(new Date());
    wasBusy.current = busy;
  }, [busy]);
  return loadedAt;
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const loadedAt = useLoadedAt();

  const isActive = (item: NavItem) => item.match.some((p) => pathname.startsWith(p));

  return (
    <aside className={`app-sidebar${collapsed ? ' app-sidebar-collapsed' : ''}`} aria-label="Primary">
      <div className="app-sidebar-brand">
        <span className="app-sidebar-logo">
          <img src={diMark} alt="Discovered Intelligence" title="Built by Discovered Intelligence" />
        </span>
        {!collapsed && (
          <span className="app-sidebar-brand-text">
            <span className="app-sidebar-brand-name">Access Insights</span>
            <span className="app-sidebar-brand-sub">for Cribl</span>
          </span>
        )}
      </div>

      <button
        type="button"
        className="app-sidebar-collapse"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      >
        {collapsed ? <ChevronRight size="sm" /> : <ChevronLeft size="sm" />}
        {!collapsed && <span>Collapse</span>}
      </button>

      <nav className="app-sidebar-nav">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`app-sidebar-item${active ? ' app-sidebar-item-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
            >
              <Icon size="md" aria-hidden />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="app-sidebar-footer">
        <NavLink
          to="/help"
          className={`app-sidebar-item${pathname.startsWith('/help') ? ' app-sidebar-item-active' : ''}`}
          title={collapsed ? 'Help' : undefined}
        >
          <HelpOutlined size="md" aria-hidden />
          {!collapsed && <span>Help</span>}
        </NavLink>
        {!collapsed && loadedAt && (
          <div className="app-sidebar-freshness" title={loadedAt.toLocaleString()}>
            <ClockOutlined size="xs" aria-hidden />
            <span>Data as of {loadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
