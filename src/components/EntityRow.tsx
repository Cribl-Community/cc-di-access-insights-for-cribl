import type { ReactNode } from 'react';
import './EntityList.css';

export type AvatarTone = 'accent' | 'highlight' | 'info';

interface EntityRowProps {
  /** Initials string or an icon element. */
  avatar: ReactNode;
  avatarTone?: AvatarTone;
  title: string;
  /** Inline element after the title (e.g. a "Disabled" tag). */
  titleTrailing?: ReactNode;
  subtitle?: string;
  selected: boolean;
  onClick: () => void;
}

/** One selectable row in a master list (users, teams, API keys). */
export function EntityRow({
  avatar,
  avatarTone = 'accent',
  title,
  titleTrailing,
  subtitle,
  selected,
  onClick,
}: EntityRowProps) {
  return (
    <li className={selected ? 'entity-row entity-row-selected' : 'entity-row'}>
      <button
        type="button"
        className="entity-row-button"
        onClick={onClick}
        aria-current={selected ? 'true' : undefined}
      >
        <span className={`entity-avatar entity-avatar-${avatarTone}`} aria-hidden>
          {avatar}
        </span>
        <span className="entity-row-text">
          <span className="entity-row-title">
            <span className="entity-row-title-text">{title}</span>
            {titleTrailing}
          </span>
          {subtitle && <span className="entity-row-subtitle">{subtitle}</span>}
        </span>
      </button>
    </li>
  );
}
