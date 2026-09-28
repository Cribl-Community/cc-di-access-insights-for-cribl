import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiOutlined, GroupOutlined, HelpOutlined, ReloadOutlined, SearchOutlined, UserOutlined } from '@capra/icons';
import { useRbacData } from '../../context/RbacDataContext';
import { classifyAuth } from '../../api/overview';
import { ProfileMenu } from './ProfileMenu';
import './TopBar.css';

interface SearchHit {
  key: string;
  kind: 'user' | 'team' | 'key';
  title: string;
  subtitle: string;
  to: string;
}

const MAX_HITS = 8;

/** Directory "find a user, team, or API key" search, plus refresh / help / signed-in user. */
export function TopBar() {
  const navigate = useNavigate();
  // Finding a principal is a Directory task, so the search lives there only.
  const showSearch = /^\/(users|teams|api-keys)(\/|$)/.test(useLocation().pathname);
  const { users, teams, reload, refreshing, loading } = useRbacData();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchHit[] = [];
    for (const u of users) {
      const name = [u.first, u.last].filter(Boolean).join(' ') || u.username || u.id;
      if (![name, u.email, u.username, u.id].some((f) => f?.toLowerCase().includes(q))) continue;
      const isKey = classifyAuth(u) === 'credential';
      out.push({
        key: `u:${u.id}`,
        kind: isKey ? 'key' : 'user',
        title: name,
        subtitle: isKey ? 'API key' : u.email || u.username,
        to: `${isKey ? '/api-keys' : '/users'}/${encodeURIComponent(u.id)}`,
      });
    }
    for (const t of teams) {
      if (![t.name, t.id, t.description].some((f) => f?.toLowerCase().includes(q))) continue;
      out.push({ key: `t:${t.id}`, kind: 'team', title: t.name, subtitle: 'Team', to: `/teams/${encodeURIComponent(t.id)}` });
    }
    return out.slice(0, MAX_HITS);
  }, [query, users, teams]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const go = (hit: SearchHit) => {
    navigate(hit.to);
    setQuery('');
    setOpen(false);
  };

  return (
    <header className="app-topbar">
      {showSearch && (
      <div className="topbar-search" ref={boxRef}>
        <SearchOutlined size="sm" aria-hidden />
        <input
          type="search"
          value={query}
          placeholder="Find a user, team, or API key…"
          aria-label="Find a user, team, or API key"
          aria-expanded={open && hits.length > 0}
          aria-controls="topbar-search-results"
          role="combobox"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && hits[active]) {
              e.preventDefault();
              go(hits[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {open && query.trim() && (
          <ul className="topbar-search-results" id="topbar-search-results" role="listbox">
            {hits.length === 0 ? (
              <li className="topbar-search-empty">No users, teams, or API keys match.</li>
            ) : (
              hits.map((hit, i) => (
                <li
                  key={hit.key}
                  role="option"
                  aria-selected={i === active}
                  className={`topbar-search-hit${i === active ? ' topbar-search-hit-active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(hit);
                  }}
                >
                  <span className={`topbar-hit-icon topbar-hit-${hit.kind}`} aria-hidden>
                    {hit.kind === 'team' ? <GroupOutlined size="sm" /> : hit.kind === 'key' ? <ApiOutlined size="sm" /> : <UserOutlined size="sm" />}
                  </span>
                  <span className="topbar-hit-text">
                    <span className="topbar-hit-title">{hit.title}</span>
                    <span className="topbar-hit-sub">{hit.subtitle}</span>
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      )}

      <div className="topbar-actions">
        <div className="topbar-pill">
          <button
            type="button"
            className="topbar-icon-btn"
            onClick={reload}
            disabled={loading || refreshing}
            aria-label={refreshing ? 'Refreshing…' : 'Refresh data'}
            title="Refresh data"
          >
            <span className={refreshing ? 'topbar-spin' : undefined}>
              <ReloadOutlined size="sm" aria-hidden />
            </span>
          </button>
          <span className="topbar-divider" aria-hidden />
          <button type="button" className="topbar-icon-btn" onClick={() => navigate('/help')} aria-label="Help" title="Help">
            <HelpOutlined size="sm" aria-hidden />
          </button>
        </div>
        <ProfileMenu />
      </div>
    </header>
  );
}
