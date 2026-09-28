import { Alert, Tag, Text } from '@capra/core';
import type { Team, User } from '../api/types';
import { TagLink } from './TagLink';
import './TeamIdpMapping.css';

interface TeamIdpMappingProps {
  team: Team;
  members: User[];
}

function memberName(user: User): string {
  return [user.first, user.last].filter(Boolean).join(' ') || user.username || user.id;
}

function MemberGroup({ label, users }: { label: string; users: User[] }) {
  return (
    <div className="idp-member-group">
      <Text color="secondary" variant="body-sm-semibold">
        {label} <span className="idp-member-count">{users.length}</span>
      </Text>
      {users.length === 0 ? (
        <Text color="secondary" variant="body-sm-normal">
          None.
        </Text>
      ) : (
        <div className="chip-row">
          {users.map((u) => (
            <TagLink key={u.id} to={`/users/${encodeURIComponent(u.id)}`}>
              {memberName(u)}
            </TagLink>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A Team's identity-provider group mapping ("Mapping IDs" / `ssoGroupIds`) and
 * what it implies. Degrades to a one-line note when the Team has no mapping or
 * the deployment doesn't report per-member IdP group data.
 */
export function TeamIdpMapping({ team, members }: TeamIdpMappingProps) {
  const mappingIds = team.ssoGroupIds ?? [];

  if (mappingIds.length === 0) {
    return (
      <Text color="secondary">
        No identity-provider group mapping. Membership is managed manually in Cribl.
      </Text>
    );
  }

  const anyMemberGroups = members.some((m) => (m.cloudMetadata?.ssoGroups ?? []).length > 0);
  const matched = members.filter((m) =>
    (m.cloudMetadata?.ssoGroups ?? []).some((g) => mappingIds.includes(g)),
  );
  const matchedIds = new Set(matched.map((m) => m.id));
  const manual = members.filter((m) => !matchedIds.has(m.id));

  return (
    <div className="idp-mapping">
      <div className="idp-mapping-field">
        <Text color="secondary" variant="body-sm-semibold">
          Mapping IDs
        </Text>
        <div className="chip-row">
          {mappingIds.map((id) => (
            <Tag key={id} color="info" size="sm">
              {id}
            </Tag>
          ))}
        </div>
      </div>

      <Alert appearance="warning" layout="inline" title="Managed by your identity provider">
        Members matched by these IdP groups are provisioned from your IdP. Per Cribl, IdP group
        memberships override any permissions set manually on a per-Member or per-Team basis. Removing
        someone from the IdP group does not remove their Cribl account — that has to be done here too.
      </Alert>

      {anyMemberGroups ? (
        <div className="idp-mapping-split">
          <MemberGroup label="Matched by IdP group" users={matched} />
          <MemberGroup label="Added manually" users={manual} />
        </div>
      ) : (
        <Text color="secondary" variant="body-sm-normal">
          This deployment doesn't report per-member IdP group data, so matched-vs-manual can't be
          shown for the current members.
        </Text>
      )}
    </div>
  );
}
