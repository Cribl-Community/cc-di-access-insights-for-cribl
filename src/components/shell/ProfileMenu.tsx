import { useEffect, useState } from 'react';
import { Popup } from './Popup';
import { initials } from '../../lib/initials';
import './ProfileMenu.css';

interface CriblUser {
  id: string;
  username: string;
  email?: string;
  name: string;
  initials: string;
}

function useCriblUser(): CriblUser | null {
  const [user, setUser] = useState<CriblUser | null>(null);
  useEffect(() => {
    let cancelled = false;
    window
      .getCriblUser?.()
      .then((u) => {
        if (cancelled) return;
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username;
        setUser({ id: u.id, username: u.username, email: u.email, name, initials: u.initials || initials(name) });
      })
      .catch(() => {
        /* outside Cribl — no signed-in user */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return user;
}

/**
 * Signed-in user's avatar; opens a panel saying who is signed in. Deliberately
 * no access summary here — "what can I do?" is Cribl Identity Checker's job;
 * this app is the admin view of everyone.
 */
export function ProfileMenu() {
  const me = useCriblUser();
  if (!me) return null;

  return (
    <Popup
      label="Signed in as"
      trigger={(p) => (
        <button {...p} type="button" className="topbar-avatar" aria-label={`Signed in as ${me.name}`} title={me.name}>
          {me.initials}
        </button>
      )}
    >
      {() => (
        <div className="pm">
          <div className="pm-head">
            <span className="pm-avatar-lg">{me.initials}</span>
            <span className="pm-email" title={me.email || me.username}>
              {me.email || me.username}
            </span>
          </div>
        </div>
      )}
    </Popup>
  );
}
