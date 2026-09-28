import type { ComponentProps } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag } from '@capra/core';
import './TagLink.css';

interface TagLinkProps {
  to: string;
  children: string;
  color?: ComponentProps<typeof Tag>['color'];
}

/** A Tag that navigates in-app on click, wrapped in a real button for keyboard accessibility. */
export function TagLink({ to, children, color }: TagLinkProps) {
  const navigate = useNavigate();
  return (
    <button type="button" className="tag-link" onClick={() => navigate(to)}>
      <Tag color={color}>{children}</Tag>
    </button>
  );
}
