import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';
import {
  ApiOutlined,
  ArrowUpRightFromSquare,
  CollapseAllOutlined,
  DashboardOutlined,
  DataInsights,
  DatabaseOutlined,
  ExpandAllOutlined,
  FleetOutlined,
  GroupOutlined,
  HomeOutlined,
  LinkOutlined,
  Notebooks,
  Packs,
  SecurityScan,
  UserOutlined,
  UsersOutlined,
  WorkersOutlined,
  WorkspaceOutlined,
  type SvgIcon,
} from '@capra/icons';
import { PRODUCTS, PRODUCT_LABELS, type Product } from '../../api/types';
import { subtreeProducts, type EdgeKind, type GraphNode } from '../../viz/accessGraph';
import { LEVEL_BUCKETS, LEVEL_BUCKET_BY_KEY, levelBucket } from '../../viz/levels';
import { ProductIcon } from '../shell/ProductIcon';
import './AccessGraph.css';

const NODE_W = 256;
const NODE_H = 64;
const GAP_Y = 18;
const GAP_X = 72;
/** Never shrink below this to fit — pan / the minimap reach the rest instead. */
const MIN_FIT_ZOOM = 0.8;
const MAX_FIT_ZOOM = 1.05;
const FIT_PAD = 32;

type AnyNode = GraphNode;

interface VisNode extends AnyNode {
  hiddenCount: number;
  totalChildren: number;
  children: VisNode[];
}

interface NodeData extends Record<string, unknown> {
  n: VisNode;
  collapsed: boolean;
  dim: boolean;
  onPath: boolean;
  onToggle: (id: string) => void;
}

function kindIcon(n: AnyNode): SvgIcon | null {
  switch (n.kind) {
    case 'user':
    case 'member':
      return UserOutlined;
    case 'apikey':
      return ApiOutlined;
    case 'team':
      return GroupOutlined;
    case 'members':
      return UsersOutlined;
    case 'direct':
      return LinkOutlined;
    case 'workspace':
      return WorkspaceOutlined;
    case 'org':
      return HomeOutlined;
    case 'role':
      return SecurityScan;
    case 'group':
      return n.products?.[0] === 'edge' ? FleetOutlined : WorkersOutlined;
    case 'resource':
      if (n.resourceType === 'datasets' || n.resourceType === 'dataset-providers') return DatabaseOutlined;
      if (n.resourceType === 'dashboards') return DashboardOutlined;
      if (n.resourceType === 'notebooks' || n.resourceType === 'notebook-templates') return Notebooks;
      if (n.resourceType === 'apps') return Packs;
      return DataInsights;
    case 'scope':
      return n.products?.length === 1 ? null : DataInsights;
    default:
      return null;
  }
}

function LevelPill({ level }: { level: string }) {
  const bucket = LEVEL_BUCKET_BY_KEY[levelBucket(level)];
  return (
    <span className="ag-level">
      <span className="ag-swatch" style={{ background: bucket.cssVar }} aria-hidden />
      {level}
    </span>
  );
}

const AccessNodeView = memo(function AccessNodeView({ data }: NodeProps<Node<NodeData>>) {
  const navigate = useNavigate();
  const { n, collapsed, dim, onPath, onToggle } = data;
  const Icon = kindIcon(n);
  const product = n.kind === 'product' || (n.kind === 'scope' && n.products?.length === 1) ? n.products?.[0] : undefined;
  const hasChildren = n.totalChildren > 0;

  return (
    <div
      className={[
        'ag-node',
        `ag-node-${n.kind}`,
        dim ? 'ag-dim' : '',
        onPath ? 'ag-on-path' : '',
        hasChildren ? 'ag-expandable' : '',
      ].join(' ')}
      title={hasChildren ? (collapsed ? 'Click to expand' : 'Click to collapse') : undefined}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="ag-handle" />
      <div className="ag-row">
        <span className={`ag-icon ag-icon-${n.kind}`} aria-hidden>
          {product ? <ProductIcon product={product} size="sm" /> : Icon ? <Icon size="sm" /> : null}
        </span>
        <span className="ag-text">
          <span className="ag-label" title={n.label}>
            {n.label}
          </span>
          {n.sublabel && (
            <span className="ag-sub" title={n.sublabel}>
              {n.sublabel}
            </span>
          )}
        </span>
        <span className="ag-right">
          {n.level && <LevelPill level={n.level} />}
          {n.link && (
            <button
              type="button"
              className="ag-open nodrag"
              aria-label={`Open ${n.label}`}
              title={`Open ${n.label}`}
              onClick={(e) => {
                e.stopPropagation();
                // Stay in Graph view when jumping to another person or Team.
                navigate(/^\/(users|teams)\//.test(n.link!) ? `${n.link}?view=graph` : n.link!);
              }}
            >
              <ArrowUpRightFromSquare size="xs" />
            </button>
          )}
        </span>
      </div>
      {hasChildren && (
        <button
          type="button"
          className="ag-toggle nodrag"
          aria-label={collapsed ? `Expand ${n.label} (${n.hiddenCount})` : `Collapse ${n.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(n.id);
          }}
        >
          {collapsed ? `+${n.hiddenCount}` : '−'}
        </button>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} className="ag-handle" />
    </div>
  );
});

const nodeTypes = { access: AccessNodeView };

function initialCollapsed(root: GraphNode): Set<string> {
  const out = new Set<string>();
  const walk = (n: GraphNode) => {
    if (n.collapsed && n.children.length) out.add(n.id);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

function edgeStyle(kind: EdgeKind | undefined, highlight: boolean) {
  const base = { strokeWidth: highlight ? 3 : 1.5 };
  switch (kind) {
    case 'team':
      return { ...base, stroke: 'var(--ag-edge-team)' };
    case 'workspace':
      return { ...base, stroke: 'var(--ag-edge-workspace)' };
    case 'inherited':
      return { ...base, stroke: 'var(--ag-edge-inherited)', strokeDasharray: '5 4' };
    case 'membership':
      return { ...base, stroke: 'var(--ag-edge-neutral)' };
    default:
      return { ...base, stroke: 'var(--ag-edge-direct)' };
  }
}

interface AccessGraphProps {
  tree: AnyNode;
  height?: number | string;
  loading?: boolean;
}

function GraphInner({ tree: root, height, loading }: AccessGraphProps) {
  const rf = useReactFlow();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => initialCollapsed(root));
  const [product, setProduct] = useState<Product | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // A new principal resets the view; late-arriving data (e.g. ACLs) only adds
  // default-collapsed branches the user hasn't seen yet, never re-collapses one.
  const rootKey = root.id + '|' + root.label;
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const defaults = initialCollapsed(root);
    seen.current = new Set(defaults);
    setCollapsed(defaults);
    setHoverId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootKey]);
  useEffect(() => {
    const fresh = [...initialCollapsed(root)].filter((id) => !seen.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => seen.current.add(id));
    setCollapsed((prev) => new Set([...prev, ...fresh]));
  }, [root]);

  const productsPresent = useMemo(() => {
    const s = subtreeProducts(root);
    return PRODUCTS.filter((p) => s.has(p));
  }, [root]);

  const vis = useMemo<VisNode>(() => {
    const productCache = new Map<string, Set<Product>>();
    const productsOf = (n: AnyNode) => {
      let s = productCache.get(n.id);
      if (!s) productCache.set(n.id, (s = subtreeProducts(n)));
      return s;
    };
    const build = (n: AnyNode, isRoot: boolean): VisNode | null => {
      if (!isRoot && product && !productsOf(n).has(product)) return null;
      const kept = (n.children as AnyNode[]).map((c) => build(c, false)).filter((c): c is VisNode => c !== null);
      const isCollapsed = collapsed.has(n.id);
      return {
        ...n,
        children: isCollapsed ? [] : kept,
        hiddenCount: isCollapsed ? kept.length : 0,
        totalChildren: kept.length,
      };
    };
    return build(root, true)!;
  }, [root, collapsed, product]);

  const { nodes, edges, parentOf } = useMemo(() => {
    const nodeH = NODE_H;
    const h = hierarchy<VisNode>(vis, (d) => d.children);
    const laid = tree<VisNode>()
      .nodeSize([nodeH + GAP_Y, NODE_W + GAP_X])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.2))(h);
    const parents = new Map<string, string>();
    const ns: Node<NodeData>[] = [];
    const es: Edge[] = [];
    laid.each((d: HierarchyPointNode<VisNode>) => {
      if (d.parent) parents.set(d.data.id, d.parent.data.id);
      ns.push({
        id: d.data.id,
        type: 'access',
        position: { x: d.y, y: d.x },
        data: {
          n: d.data,
          collapsed: collapsed.has(d.data.id),
          dim: false,
          onPath: false,
          onToggle: () => undefined,
        },
        draggable: false,
        connectable: false,
        width: NODE_W,
        height: nodeH,
      });
      if (d.parent) {
        es.push({
          id: `${d.parent.data.id}->${d.data.id}`,
          source: d.parent.data.id,
          target: d.data.id,
          type: 'smoothstep',
          data: { kind: d.data.edge },
        });
      }
    });
    return { nodes: ns, edges: es, parentOf: parents };
  }, [vis, collapsed]);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // The hovered node's granting path: itself and every ancestor up to the root.
  const path = useMemo(() => {
    if (!hoverId) return null;
    const s = new Set<string>();
    for (let id: string | undefined = hoverId; id; id = parentOf.get(id)) s.add(id);
    return s;
  }, [hoverId, parentOf]);

  const shownNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, onToggle: toggle, dim: Boolean(path && !path.has(n.id)), onPath: Boolean(path?.has(n.id)) },
      })),
    [nodes, path, toggle],
  );
  const shownEdges = useMemo(
    () =>
      edges.map((e) => {
        const hi = Boolean(path?.has(e.target));
        const d = e.data as { kind?: EdgeKind };
        // Edges mean "grants / inherits", not data in motion — so the hovered
        // path is emphasised statically (weight + glow), never animated.
        const style = edgeStyle(d.kind, hi);
        return {
          ...e,
          style: {
            ...style,
            opacity: path && !hi ? 0.18 : 1,
            filter: hi ? `drop-shadow(0 0 3px ${style.stroke})` : undefined,
          },
          zIndex: hi ? 1 : 0,
        };
      }),
    [edges, path],
  );

  // Re-fit whenever the visible shape changes: fit the whole tree when it fits
  // at a readable zoom; otherwise stay readable and anchor the root at the left.
  const canvasRef = useRef<HTMLDivElement>(null);
  // The canvas fills its container, so re-fit when that size changes too.
  const [canvasSize, setCanvasSize] = useState('');
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasSize(`${el.clientWidth}x${el.clientHeight}`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = canvasRef.current;
      if (!el || nodes.length === 0) return;
      const minX = Math.min(...nodes.map((n) => n.position.x));
      const maxX = Math.max(...nodes.map((n) => n.position.x)) + NODE_W;
      const minY = Math.min(...nodes.map((n) => n.position.y));
      const nodeH = NODE_H;
      const maxY = Math.max(...nodes.map((n) => n.position.y)) + nodeH;
      const w = el.clientWidth - FIT_PAD * 2;
      const h = el.clientHeight - FIT_PAD * 2;
      const fitZoom = Math.min(w / (maxX - minX), h / (maxY - minY));
      const zoom = Math.max(MIN_FIT_ZOOM, Math.min(MAX_FIT_ZOOM, fitZoom));
      const rootNode = nodes.find((n) => n.id === root.id) ?? nodes[0];
      const fitsX = (maxX - minX) * zoom <= w;
      const fitsY = (maxY - minY) * zoom <= h;
      const x = fitsX
        ? (el.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom
        : FIT_PAD - minX * zoom;
      const y = fitsY
        ? (el.clientHeight - (maxY - minY) * zoom) / 2 - minY * zoom
        : el.clientHeight / 2 - (rootNode.position.y + nodeH / 2) * zoom;
      void rf.setViewport({ x, y, zoom }, { duration: 250 });
    }, 40);
    return () => window.clearTimeout(t);
  }, [nodes, rf, root.id, canvasSize]);

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => {
    const s = new Set<string>();
    root.children.forEach((c) => {
      const walk = (n: GraphNode) => {
        if (n.children.length) s.add(n.id);
        n.children.forEach(walk);
      };
      walk(c);
    });
    setCollapsed(s);
  };

  return (
    <div className="ag">
      <div className="ag-toolbar">
        <div className="ag-chips" role="group" aria-label="Filter by product">
          <button
            type="button"
            className={`ag-chip${product === null ? ' ag-chip-active' : ''}`}
            onClick={() => setProduct(null)}
            aria-pressed={product === null}
          >
            All products
          </button>
          {productsPresent.map((p) => (
            <button
              key={p}
              type="button"
              className={`ag-chip${product === p ? ' ag-chip-active' : ''}`}
              onClick={() => setProduct(product === p ? null : p)}
              aria-pressed={product === p}
            >
              <ProductIcon product={p} size="xs" />
              {PRODUCT_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="ag-actions">
          <button type="button" className="ag-action" onClick={expandAll}>
            <ExpandAllOutlined size="sm" aria-hidden /> Expand all
          </button>
          <button type="button" className="ag-action" onClick={collapseAll}>
            <CollapseAllOutlined size="sm" aria-hidden /> Collapse all
          </button>
        </div>
      </div>

      <div className="ag-canvas" style={height !== undefined ? { height, flex: 'none' } : undefined} ref={canvasRef}>
        {loading && <div className="ag-loading">Loading resource grants…</div>}
        <ReactFlow
          nodes={shownNodes}
          edges={shownEdges}
          nodeTypes={nodeTypes}
          colorMode={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
          onNodeClick={(_, n) => {
            if ((n.data as NodeData).n.totalChildren > 0) toggle(n.id);
          }}
          onNodeMouseEnter={(_, n) => setHoverId(n.id)}
          onNodeMouseLeave={() => setHoverId(null)}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          minZoom={0.2}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={22} size={1} color="var(--ag-grid)" />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
      </div>

      <div className="ag-legend" aria-label="Legend">
        <span className="ag-legend-item">
          <span className="ag-legend-line" style={{ background: 'var(--ag-edge-direct)' }} /> Direct
        </span>
        <span className="ag-legend-item">
          <span className="ag-legend-line" style={{ background: 'var(--ag-edge-team)' }} /> via Team
        </span>
        <span className="ag-legend-item">
          <span className="ag-legend-line" style={{ background: 'var(--ag-edge-workspace)' }} /> via Workspace
        </span>
        <span className="ag-legend-item">
          <span className="ag-legend-line ag-legend-dashed" /> Inherited
        </span>
        <span className="ag-legend-sep" aria-hidden />
        {LEVEL_BUCKETS.filter((b) => b.key !== 'none').map((b) => (
          <span key={b.key} className="ag-legend-item">
            <span className="ag-swatch" style={{ background: b.cssVar }} /> {b.label}
          </span>
        ))}
        <span className="ag-legend-hint">Click a node to expand · hover to trace how access is granted</span>
      </div>
    </div>
  );
}

/** Interactive access tree for one principal (User, Team, or API key). */
export function AccessGraph(props: AccessGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
