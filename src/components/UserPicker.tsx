import { useId } from 'react';
import { Text } from '@capra/core';
import type { User } from '../api/types';
import './UserPicker.css';

interface UserPickerProps {
  label: string;
  users: User[];
  value: string | null;
  onChange: (userId: string | null) => void;
  /** A user id to mark as already taken by the other picker (still selectable, shown with a hint). */
  excludeId?: string | null;
}

function displayName(user: User): string {
  return [user.first, user.last].filter(Boolean).join(' ') || user.username || user.id;
}

/** A labelled native <select> for choosing one user out of the roster. */
export function UserPicker({ label, users, value, onChange, excludeId }: UserPickerProps) {
  const id = useId();
  const sorted = [...users].sort((a, b) => displayName(a).localeCompare(displayName(b)));

  return (
    <div className="user-picker">
      <Text as="label" color="secondary" variant="body-sm-semibold" {...{ htmlFor: id }}>
        {label}
      </Text>
      <select
        id={id}
        className="user-picker-select"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Select a user…</option>
        {sorted.map((user) => (
          <option key={user.id} value={user.id}>
            {displayName(user)}
            {user.email ? ` — ${user.email}` : ''}
            {excludeId && user.id === excludeId ? ' (already selected)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
