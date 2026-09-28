import { useMemo } from 'react';
import { Tag, Text } from '@capra/core';
import { ApiOutlined } from '@capra/icons';
import type { User, UserAccess } from '../api/types';
import { summarizeGroupAccess } from '../api/acl';
import { useUserAcl } from '../hooks/useUserAcl';
import { DetailSection } from './DetailSection';
import { EffectiveRolesTable } from './EffectiveRolesTable';
import { ResourceAccess } from './ResourceAccess';
import { resolveGroupAdminReach } from '../api/access';
import { useRbacData } from '../context/RbacDataContext';
import { buildUserGraph, groupsBySource } from '../viz/accessGraph';
import { LazyAccessGraph as AccessGraph } from './graph/LazyAccessGraph';
import { ProductLevelStrip } from './graph/ProductLevelStrip';
import { ViewToggle } from './graph/ViewToggle';
import { useDetailView } from './graph/useDetailView';
import './DetailPanel.css';

interface ApiKeyDetailProps {
  apiKey: User;
  access: UserAccess;
}

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv-row">
      <Text color="secondary" variant="body-sm-normal">
        {label}
      </Text>
      <Text variant="body-sm-normal">{value}</Text>
    </div>
  );
}

export function ApiKeyDetail({ apiKey, access }: ApiKeyDetailProps) {
  const { data: acl, loading: aclLoading } = useUserAcl(apiKey.id);

  const groupAccess = useMemo(
    () =>
      acl
        ? summarizeGroupAccess(
            acl.byProduct.map((entry) => ({ product: entry.product, entries: entry.entries })),
          )
        : null,
    [acl],
  );
  const { groupById } = useRbacData();
  // Details is the full picture; the graph is for tracing how access is granted.
  const [view, setView] = useDetailView('details');
  const graph = useMemo(
    () =>
      buildUserGraph({
        user: apiKey,
        access,
        groupsBySource: groupsBySource(acl, new Map(), []),
        adminReach: resolveGroupAdminReach(apiKey, access.effectiveRoles),
        groupById,
      }),
    [apiKey, access, acl, groupById],
  );

  const name = [apiKey.first, apiKey.last].filter(Boolean).join(' ') || apiKey.username || apiKey.id;
  const created = formatDate(apiKey.createdDate);
  const updated = formatDate(apiKey.lastUpdatedDate);

  const rows: Array<{ label: string; value: string }> = [];
  if (apiKey.createdBy) rows.push({ label: 'Created by', value: apiKey.createdBy });
  if (created) rows.push({ label: 'Created', value: created });
  if (apiKey.creatorRole) rows.push({ label: 'Creator role', value: apiKey.creatorRole });
  if (updated) rows.push({ label: 'Last updated', value: updated });
  if (apiKey.workspaceName) rows.push({ label: 'Workspace', value: apiKey.workspaceName });
  if (apiKey.ipAllowList && apiKey.ipAllowList.length > 0) {
    rows.push({ label: 'IP allow list', value: apiKey.ipAllowList.join(', ') });
  }

  return (
    <div className={view === 'graph' ? 'detail-panel detail-panel-fill' : 'detail-panel'}>
      <div className="detail-header-with-toggle">
      <header className="detail-header">
        <div className="detail-avatar detail-avatar-team" aria-hidden>
          <ApiOutlined />
        </div>
        <div className="detail-header-text">
          <div className="detail-header-title">
            <Text as="h1" variant="heading-md">
              {name}
            </Text>
            {apiKey.disabled && (
              <Tag color="danger" size="sm">
                Disabled
              </Tag>
            )}
          </div>
          <Text color="secondary">{apiKey.id}</Text>
          {apiKey.description && <Text>{apiKey.description}</Text>}
        </div>
      </header>
      <ViewToggle view={view} onChange={setView} first="details" />
      </div>

      {view === 'graph' ? (
        <>
          <ProductLevelStrip user={apiKey} effectiveRoles={access.effectiveRoles} />
          <section className="detail-graph-card glass-card" aria-label="Access graph">
            <AccessGraph tree={graph} loading={aclLoading} />
          </section>
        </>
      ) : (
      <>

      {rows.length > 0 && (
        <DetailSection title="Details">
          <div className="kv-list">
            {rows.map((r) => (
              <DetailRow key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        </DetailSection>
      )}

      <DetailSection title="Effective Roles" count={access.effectiveRoles.length}>
        <EffectiveRolesTable
          roles={access.effectiveRoles}
          emptyText="No Roles assigned to this API key."
        />
      </DetailSection>

      <DetailSection title="Resource Access">
        <ResourceAccess
          groups={groupAccess}
          loading={aclLoading}
          unavailableProducts={acl?.unavailableProducts}
        />
      </DetailSection>
      </>
      )}
    </div>
  );
}
