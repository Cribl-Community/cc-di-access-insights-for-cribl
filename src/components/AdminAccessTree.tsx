import { Tag, Text } from '@capra/core';
import { InfoOutlined } from '@capra/icons';
import { PRODUCT_LABELS } from '../api/types';
import type { GroupAdminReach } from '../api/access';
import './AdminAccessTree.css';

interface TreeNode {
  label: string;
  access: string;
  children: TreeNode[];
}

const resourceNode = (kinds: string): TreeNode => ({
  label: `Resources (${kinds})`,
  access: 'Maintainer',
  children: [],
});

const streamEdgeBranch = (): TreeNode => ({
  label: 'Cribl Stream & Edge',
  access: 'Admin',
  children: [
    {
      label: 'Worker Groups & Edge Fleets',
      access: 'Admin',
      children: [resourceNode('Pipelines, Packs, Lookups, …')],
    },
  ],
});

const searchLakeBranch = (): TreeNode => ({
  label: 'Cribl Search & Lake',
  access: 'Admin',
  children: [resourceNode('Datasets, Dashboards, Notebooks, …')],
});

function treeFor(reach: GroupAdminReach): TreeNode {
  if (reach.scope === 'org') {
    return {
      label: 'Organization',
      access: reach.owner ? 'Owner' : 'Admin',
      children: [
        { label: 'Workspaces', access: 'Admin', children: [streamEdgeBranch(), searchLakeBranch()] },
      ],
    };
  }
  if (reach.scope === 'workspace') {
    const label =
      reach.workspaceIds.length === 0
        ? 'Workspaces'
        : reach.workspaceIds.length === 1
          ? `Workspace ${reach.workspaceIds[0]}`
          : `Workspaces (${reach.workspaceIds.join(', ')})`;
    return {
      label,
      access: reach.owner ? 'Owner' : 'Admin',
      children: [streamEdgeBranch(), searchLakeBranch()],
    };
  }
  const product = reach.product;
  const groupLabel =
    product === 'edge' ? 'Edge Fleets' : product === 'outpost' ? 'Outpost Groups' : 'Worker Groups';
  return {
    label: `Cribl ${product ? PRODUCT_LABELS[product] : 'product'}`,
    access: 'Admin',
    children: [
      {
        label: groupLabel,
        access: 'Admin',
        children: [resourceNode('Pipelines, Packs, Lookups, …')],
      },
    ],
  };
}

function Node({ node }: { node: TreeNode }) {
  return (
    <li className="aat-node">
      <span className="aat-row">
        <Text as="span" variant="body-sm-normal">
          {node.label}
        </Text>
        <Tag color="highlight" size="sm">
          {node.access}
        </Tag>
      </span>
      {node.children.length > 0 && (
        <ul className="aat-children">
          {node.children.map((child, i) => (
            <Node key={i} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

function roleLabel(reach: GroupAdminReach): string {
  const level = reach.owner ? 'owner' : 'admin';
  if (reach.scope === 'org') return `Organization ${level}`;
  if (reach.scope === 'workspace') return `Workspace ${level}`;
  return `${reach.product ? PRODUCT_LABELS[reach.product] : 'Product'} admin`;
}

function grantedVia(reach: GroupAdminReach): string {
  const parts = reach.sources.flatMap((s) => {
    if (s.kind === 'team') return [`Team ${s.teamName}`];
    if (s.kind === 'workspace') return [`a Workspace role (${s.workspaceId})`];
    return [];
  });
  return parts.length ? ` — via ${parts.join(', ')}` : '';
}

/** Shows an admin user's Worker Group / resource access as the inherited-permission chain. */
export function AdminAccessTree({ reach }: { reach: GroupAdminReach[] }) {
  return (
    <div className="aat">
      {reach.map((r, i) => (
        <div className="aat-block" key={i}>
          <div className="aat-header">
            <InfoOutlined aria-hidden />
            <Text variant="body-md-semibold">{roleLabel(r)}</Text>
            <Text color="secondary" variant="body-sm-normal">
              inherited top-down{grantedVia(r)}
            </Text>
          </div>
          <ul className="aat-root">
            <Node node={treeFor(r)} />
          </ul>
        </div>
      ))}
    </div>
  );
}
