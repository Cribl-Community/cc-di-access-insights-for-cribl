import { Tag, Text } from '@capra/core';
import { PRODUCT_LABELS, type EffectiveRole, type RoleSource } from '../api/types';
import { productForRoleId } from '../api/access';
import { TagLink } from './TagLink';
import './DetailPanel.css';

function RoleSourceTag({ source }: { source: RoleSource }) {
  switch (source.kind) {
    case 'direct':
      return <Tag size="sm">Direct</Tag>;
    case 'team':
      return (
        <TagLink to={`/teams/${encodeURIComponent(source.team.id)}`} color="info">
          {`via ${source.team.name}`}
        </TagLink>
      );
    case 'workspace':
      return (
        <Tag size="sm" color="highlight">
          {`Workspace: ${source.workspaceId}`}
        </Tag>
      );
  }
}

interface EffectiveRolesTableProps {
  roles: EffectiveRole[];
  /** Message shown when there are no roles. */
  emptyText: string;
}

/** Role / Product / Granted-via table, shared by the User and API Key detail panels. */
export function EffectiveRolesTable({ roles, emptyText }: EffectiveRolesTableProps) {
  if (roles.length === 0) {
    return <Text color="secondary">{emptyText}</Text>;
  }
  return (
    <table className="detail-table role-table">
      <thead>
        <tr>
          <th scope="col">Role</th>
          <th scope="col">Product</th>
          <th scope="col">Granted via</th>
        </tr>
      </thead>
      <tbody>
        {roles.map(({ role, sources }) => {
          const product = productForRoleId(role.id);
          return (
            <tr key={role.id}>
              <td>
                <Tag color="brand">{role.title || role.id}</Tag>
              </td>
              <td>
                {product ? (
                  <Tag color="highlight" size="sm">
                    {PRODUCT_LABELS[product]}
                  </Tag>
                ) : (
                  <Text color="secondary" variant="body-sm-normal">
                    All products
                  </Text>
                )}
              </td>
              <td>
                <span className="chip-row">
                  {sources.map((source, i) => (
                    <RoleSourceTag key={`${source.kind}-${i}`} source={source} />
                  ))}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
