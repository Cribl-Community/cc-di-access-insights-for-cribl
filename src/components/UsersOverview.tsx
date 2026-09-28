import { EmptyState } from '@capra/core';

/** Empty state shown in the Users detail pane before a user is picked. */
export function UsersOverview() {
  return (
    <EmptyState
      illustration="EmptySuitcase"
      size="lg"
      title="Select a user"
      description="Choose a user from the list to see their Teams, effective Roles, and resolved resource access."
    />
  );
}
