import type { ReactNode } from 'react';
import { Card } from '@capra/core';
import './DetailSection.css';

interface DetailSectionProps {
  title: string;
  /** Optional count shown as a pill next to the title (e.g. member count). */
  count?: number;
  /** Optional trailing content in the header (filters, links). */
  action?: ReactNode;
  children: ReactNode;
}

/** A titled card used to group one block of a detail panel. */
export function DetailSection({ title, count, action, children }: DetailSectionProps) {
  return (
    <Card className="detail-section">
      <Card.Header className="detail-section-header">
        <Card.Title variant="body-md-semibold">
          <span className="detail-section-title">
            {title}
            {count !== undefined && <span className="detail-section-count">{count}</span>}
          </span>
        </Card.Title>
        {action && <Card.Action>{action}</Card.Action>}
      </Card.Header>
      <Card.Content className="detail-section-content">{children}</Card.Content>
    </Card>
  );
}
