import { EllipsisVertical } from '@capra/icons';
import { Popup } from '../shell/Popup';
import './dashboard.css';

export interface CardMenuItem {
  label: string;
  onSelect: () => void;
}

/** The ⋯ button on a table row, opening a short action list. */
export function CardMenu({ items, label = 'More actions' }: { items: CardMenuItem[]; label?: string }) {
  return (
    <Popup
      role="menu"
      label={label}
      trigger={(p) => (
        <button {...p} type="button" className="card-menu-trigger" aria-label={label}>
          <EllipsisVertical size="sm" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <ul className="card-menu">
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className="card-menu-item"
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popup>
  );
}
