import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Popup.css';

interface TriggerProps {
  ref: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'dialog' | 'menu';
  'aria-controls': string;
}

interface PopupProps {
  /** Render the trigger button; spread the given props onto it. */
  trigger: (props: TriggerProps) => ReactNode;
  /** Panel content; `close` lets actions inside dismiss it. */
  children: (close: () => void) => ReactNode;
  role?: 'dialog' | 'menu';
  label: string;
  /** Right-align the panel with the trigger (default) or left-align. */
  align?: 'end' | 'start';
}

/**
 * A small anchored popover that works with any button trigger (Capra's Popover
 * only opens from Capra's own Button components). Rendered in a portal with
 * fixed positioning so a scrolling / overflow-hidden ancestor can't clip it;
 * closes on outside click, Escape (returning focus to the trigger), scroll, or
 * resize.
 */
export function Popup({ trigger, children, role = 'dialog', label, align = 'end' }: PopupProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos(
      align === 'end'
        ? { top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) }
        : { top: r.bottom + 8, left: Math.max(8, r.left) },
    );
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onResize = () => close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    // Move focus into the panel for keyboard users.
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])')?.focus();
    }, 0);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      window.clearTimeout(t);
    };
  }, [open, close]);

  return (
    <>
      {trigger({
        ref: (el) => {
          triggerRef.current = el;
        },
        onClick: () => setOpen((v) => !v),
        'aria-expanded': open,
        'aria-haspopup': role,
        'aria-controls': id,
      })}
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            role={role}
            aria-label={label}
            className="popup-panel"
            style={{ top: pos.top, left: pos.left, right: pos.right }}
          >
            {children(() => close())}
          </div>,
          document.body,
        )}
    </>
  );
}
