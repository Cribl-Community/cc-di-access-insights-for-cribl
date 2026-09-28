import { Link } from 'react-router-dom';
import { EmptyState, Spinner, Tag, Text } from '@capra/core';
import { PRODUCT_LABELS, PRODUCTS, type AccessSource, type GroupAccess, type Product } from '../api/types';
import type { GroupAdminReach } from '../api/access';
import { formatPolicy, groupKindLabel } from '../api/acl';
import { useRbacData } from '../context/RbacDataContext';
import { AdminAccessTree } from './AdminAccessTree';
import { TagLink } from './TagLink';
import './ResourceAccess.css';

interface ResourceAccessProps {
  /** Summarized rows, or null while loading. */
  groups: GroupAccess[] | null;
  loading: boolean;
  /** True when the whole ACL couldn't be read (as opposed to genuinely no access). */
  unavailable?: boolean;
  /** Products whose ACL couldn't be read — shown as a caveat so an empty list isn't mistaken for "no access". */
  unavailableProducts?: Product[];
  /** Teams whose ACL couldn't be read — same idea, for Team-inherited access. */
  unavailableTeams?: string[];
  /** Show where each grant came from (Direct / via Team). Off for the Team panel, where every grant is direct. */
  showSources?: boolean;
  /** Admin roles (org / Workspace / per-product) that reach groups implicitly — shown up front. */
  adminReach?: GroupAdminReach[];
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  groups: 'Group',
  datasets: 'Dataset',
  'dataset-providers': 'Dataset Provider',
  projects: 'Project',
  dashboards: 'Dashboard',
  macros: 'Macro',
  notebooks: 'Notebook',
  'notebook-templates': 'Notebook Template',
  apps: 'App',
};

function SourceTag({ source }: { source: AccessSource }) {
  switch (source.kind) {
    case 'direct':
      return <Tag size="sm">Direct</Tag>;
    case 'workspace':
      return (
        <Tag size="sm" color="highlight">
          {`Workspace: ${source.workspaceId}`}
        </Tag>
      );
    case 'team':
      return (
        <TagLink to={`/teams/${encodeURIComponent(source.teamId)}`} color="info">
          {`via ${source.teamName}`}
        </TagLink>
      );
  }
}

function Caveats({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="ra-caveats">
      {items.map((c) => (
        <Text key={c} color="secondary" variant="body-sm-normal">
          {c}
        </Text>
      ))}
    </div>
  );
}

export function ResourceAccess({
  groups,
  loading,
  unavailable,
  unavailableProducts,
  unavailableTeams,
  showSources = true,
  adminReach = [],
}: ResourceAccessProps) {
  const { groupById } = useRbacData();

  // Org / Workspace admins have Admin on every group and Maintainer on every
  // resource by inheritance — the notice says it all, so don't also enumerate a
  // list of explicit grants that adds nothing.
  if (adminReach.some((g) => g.scope === 'org' || g.scope === 'workspace')) {
    return (
      <div className="ra">
        <AdminAccessTree reach={adminReach} />
      </div>
    );
  }

  const caveats: string[] = [];
  const missingProducts = [...(unavailableProducts ?? [])].sort(
    (a, b) => PRODUCTS.indexOf(a) - PRODUCTS.indexOf(b),
  );
  if (missingProducts.length > 0) {
    caveats.push(`Couldn't read access for ${missingProducts.map((p) => PRODUCT_LABELS[p] ?? p).join(', ')}.`);
  }
  if (unavailableTeams && unavailableTeams.length > 0) {
    caveats.push(`Couldn't read Team access for ${unavailableTeams.join(', ')}.`);
  }

  if (loading || !groups) {
    return (
      <div className="ra-loading">
        <Spinner size="sm" title="Loading resource access…" />
      </div>
    );
  }

  if (unavailable) {
    return (
      <EmptyState
        size="md"
        title="Resource access unavailable"
        description="This app wasn't able to read the resource access control list here."
      />
    );
  }

  if (groups.length === 0) {
    return (
      <div className="ra">
        {adminReach.length > 0 ? (
          <AdminAccessTree reach={adminReach} />
        ) : (
          <EmptyState
            size="md"
            title="No resolved resource access"
            description="No Worker Group, Fleet, or resource-level access on the products this app can check."
          />
        )}
        <Caveats items={caveats} />
      </div>
    );
  }

  const rows = groups.flatMap((group) => {
    const meta = groupById.get(group.gid);
    const product = group.product ?? meta?.product;
    const pseudoGroup = !group.groupPolicy && !meta;
    const title = meta?.name ?? (pseudoGroup && product ? PRODUCT_LABELS[product] : group.gid);
    const kind = pseudoGroup ? 'Resource grants' : groupKindLabel(product);

    const groupRows: AccessRow[] = [];
    if (group.groupPolicy) {
      groupRows.push({
        gid: group.gid,
        resource: null,
        policy: group.groupPolicy.policy,
        sources: group.groupPolicy.sources,
      });
    }
    for (const rp of group.resourcePolicies) {
      groupRows.push({
        gid: group.gid,
        resource: `${RESOURCE_TYPE_LABELS[rp.type] ?? rp.type}${rp.id ? ` · ${rp.id}` : ''}`,
        policy: rp.policy,
        sources: rp.sources,
      });
    }
    return groupRows.map((row, i) => ({
      ...row,
      groupTitle: title,
      groupKind: kind,
      // Only a group in our roster can be opened in the reverse lookup.
      groupLink: meta ? `/worker-groups/${encodeURIComponent(group.gid)}` : null,
      first: i === 0,
    }));
  });

  return (
    <div className="ra">
      {adminReach.length > 0 && <AdminAccessTree reach={adminReach} />}
      <table className="detail-table access-table">
        <thead>
          <tr>
            <th scope="col">Group</th>
            <th scope="col">Resource</th>
            <th scope="col">Access</th>
            {showSources && <th scope="col">Granted via</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={row.first && i > 0 ? 'access-group-start' : undefined}>
              <td>
                {row.first && (
                  <span className="access-group-cell">
                    {row.groupLink ? (
                      <Link to={row.groupLink} className="access-group-link">
                        {row.groupTitle}
                      </Link>
                    ) : (
                      <Text as="span" variant="body-sm-semibold">
                        {row.groupTitle}
                      </Text>
                    )}
                    <Text as="span" color="secondary" variant="body-xs-normal">
                      {row.groupKind}
                    </Text>
                  </span>
                )}
              </td>
              <td>
                <Text as="span" color="secondary" variant="body-sm-normal">
                  {row.resource ?? 'Group access'}
                </Text>
              </td>
              <td>
                <Tag color={row.resource ? 'default' : 'success'} size="sm">
                  {formatPolicy(row.policy)}
                </Tag>
              </td>
              {showSources && (
                <td>
                  <span className="chip-row">
                    {row.sources.map((s, j) => (
                      <SourceTag key={j} source={s} />
                    ))}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <Caveats items={caveats} />
    </div>
  );
}

interface AccessRow {
  gid: string;
  /** Resource label, or null for the group-level access row. */
  resource: string | null;
  policy: string;
  sources: AccessSource[];
}
