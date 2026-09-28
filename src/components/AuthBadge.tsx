import { Tag } from '@capra/core';
import { describeAuth } from '../api/overview';
import type { User } from '../api/types';

/** A small tag stating how an account signs in (SAML SSO / OIDC SSO / SSO / Local / API key). */
export function AuthBadge({ user }: { user: User }) {
  const { kind, label } = describeAuth(user);
  const color = kind === 'saml' || kind === 'sso' ? 'info' : kind === 'credential' ? 'accent' : 'default';
  return (
    <Tag color={color} size="sm">
      {label}
    </Tag>
  );
}
