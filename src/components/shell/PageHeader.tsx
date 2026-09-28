import type { ReactNode } from 'react';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Buttons on the right (Export, primary action, …). */
  actions?: ReactNode;
  /** Content under the title row, e.g. a segmented control. */
  children?: ReactNode;
}

/** Title + subtitle on the left, actions on the right — the header every page shares. */
export function PageHeader({ title, subtitle, actions, children }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-row">
        <div className="page-header-text">
          <h1 className="page-header-title">{title}</h1>
          {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
