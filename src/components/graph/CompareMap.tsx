import { memo, useEffect, useMemo, useState } from 'react';
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
import {
  DashboardOutlined,
  DataInsights,
  DatabaseOutlined,
  FleetOutlined,
  GroupOutlined,
  HomeOutlined,
  Notebooks,
  Packs,
  SecurityScan,
  WorkersOutlined,
  type SvgIcon,
} from '@capra/icons';
import { PRODUCTS, PRODUCT_LABELS, type Product } from '../../api/types';
import { initials } from '../../lib/initials';
import { MAP_CATEGORIES, levelDiffers, type MapItem } from '../../viz/compareMap';
import { LEVEL_BUCKET_BY_KEY, levelBucket } from '../../viz/levels';
import { ProductIcon } from '../shell/ProductIcon';
import './CompareMap.css';

const PERSON_W = 210;
const PERSON_H = 110;
const ITEM_W = 250;
const ITEM_H = 72;
const ROW_GAP = 12;
const COL = { a: 290, both: 600, b: 910 } as const;
const B_X = 1220;

type Who = 'a' | 'b';

interface PersonData extends Record<string, unknown> {
  who: Who;
  name: string;
  email: string;
  count: number;
  dim: boolean;
}

interface ItemData extends Record<string, unknown> {
  item: MapItem;
  names: { a: string; b: string };
  dim: boolean;
  hot: boolean;
}

interface LabelData extends Record<string, unknown> {
  text: string;
  tone: 'a' | 'both' | 'b' | 'section';
  width: number;
}

const firstName = (full: string) => full.split(/\s+/)[0] || full;

function itemIcon(item: MapItem): SvgIcon {
  switch (item.kind) {
    case 'team':
      return GroupOutlined;
    case 'role':
      return SecurityScan;
    case 'reach':
      return HomeOutlined;
    case 'group':
      return item.product === 'edge' ? FleetOutlined : WorkersOutlined;
    default:
      if (item.resourceType === 'datasets' || item.resourceType === 'dataset-providers') return DatabaseOutlined;
      if (item.resourceType === 'dashboards') return DashboardOutlined;
      if (item.resourceType === 'notebooks' || item.resourceType === 'notebook-templates') return Notebooks;
      if (item.resourceType === 'apps') return Packs;
      return DataInsights;
  }
}

function Level({ level, who }: { level: string; who?: string }) {
  const bucket = LEVEL_BUCKET_BY_KEY[levelBucket(level)];
  return (
    <span className="cm-level">
      <span className="cm-dot" style={{ background: bucket.cssVar }} aria-hidden />
      {who && <span className="cm-level-who">{who}</span>}
      {level}
    </span>
  );
}

const PersonNode = memo(function PersonNode({ data }: NodeProps<Node<PersonData>>) {
  return (
    <div className={`cm-person cm-person-${data.who}${data.dim ? ' cm-dim' : ''}`}>
      <span className="cm-avatar">{initials(data.name)}</span>
      <span className="cm-person-name" title={data.name}>
        {data.name}
      </span>
      <span className="cm-person-sub" title={data.email}>
        {data.email}
      </span>
      <span className="cm-person-count">{data.count} grants</span>
      <Handle
        type="source"
        id="out"
        position={data.who === 'a' ? Position.Right : Position.Left}
        isConnectable={false}
        className="cm-handle"
      />
    </div>
  );
});

const ItemNode = memo(function ItemNode({ data }: NodeProps<Node<ItemData>>) {
  const navigate = useNavigate();
  const { item, names, dim, hot } = data;
  const Icon = itemIcon(item);
  const differs = levelDiffers(item);
  const tone = differs ? 'warn' : item.lane;

  const viaText =
    item.lane === 'a'
      ? item.viaA.join(', ')
      : item.lane === 'b'
        ? item.viaB.join(', ')
        : item.viaA.join(', ') === item.viaB.join(', ')
          ? item.viaA.join(', ')
          : `${firstName(names.a)} ${item.viaA.join(', ')} · ${firstName(names.b)} ${item.viaB.join(', ')}`;

  return (
    <div
      className={`cm-item cm-tone-${tone}${dim ? ' cm-dim' : ''}${hot ? ' cm-hot' : ''}${item.link ? ' cm-clickable' : ''}`}
      onClick={() => item.link && navigate(item.link)}
      title={item.link ? `Open ${item.label}` : undefined}
    >
      <Handle type="target" id="l" position={Position.Left} isConnectable={false} className="cm-handle" />
      <Handle type="target" id="r" position={Position.Right} isConnectable={false} className="cm-handle" />
      <span className="cm-icon" aria-hidden>
        {item.product && (item.kind === 'reach' || item.kind === 'role') ? (
          <ProductIcon product={item.product} size="sm" />
        ) : (
          <Icon size="sm" />
        )}
      </span>
      <span className="cm-text">
        <span className="cm-label" title={item.label}>
          {item.label}
        </span>
        {item.context && (
          <span className="cm-context" title={item.context}>
            {item.context}
          </span>
        )}
        {viaText && (
          <span className="cm-via" title={viaText}>
            {viaText}
          </span>
        )}
      </span>
      <span className="cm-levels">
        {differs ? (
          <>
            <Level level={item.levelA!} who={firstName(names.a)} />
            <Level level={item.levelB!} who={firstName(names.b)} />
          </>
        ) : (
          (item.levelA ?? item.levelB) && <Level level={(item.levelA ?? item.levelB)!} />
        )}
      </span>
    </div>
  );
});

const LabelNode = memo(function LabelNode({ data }: NodeProps<Node<LabelData>>) {
  return (
    <div className={`cm-lane-label cm-lane-label-${data.tone}`} style={{ width: data.width }}>
      {data.text}
    </div>
  );
});

const nodeTypes = { person: PersonNode, item: ItemNode, label: LabelNode };

interface CompareMapProps {
  items: MapItem[];
  names: { a: string; b: string };
  emails: { a: string; b: string };
  onlyDiff: boolean;
  loading?: boolean;
}

function MapInner({ items, names, emails, onlyDiff, loading }: CompareMapProps) {
  const rf = useReactFlow();
  const [product, setProduct] = useState<Product | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const productsPresent = useMemo(
    () => PRODUCTS.filter((p) => items.some((i) => i.product === p)),
    [items],
  );

  const visible = useMemo(
    () =>
      items.filter((i) => {
        if (onlyDiff && i.lane === 'both' && !levelDiffers(i)) return false;
        if (product && i.product !== product && !(i.kind === 'reach' && !i.product)) return false;
        return true;
      }),
    [items, onlyDiff, product],
  );

  const counts = useMemo(() => {
    const c = { a: 0, both: 0, b: 0, differs: 0 };
    for (const i of items) {
      c[i.lane] += 1;
      if (levelDiffers(i)) c.differs += 1;
    }
    return c;
  }, [items]);

  const { nodes, edges, height } = useMemo(() => {
    const ns: Node[] = [];
    const es: Edge[] = [];
    let y = 44;
    const laneWidth = COL.b + ITEM_W - COL.a;

    for (const cat of MAP_CATEGORIES) {
      const inCat = visible.filter((i) => i.category === cat.key);
      if (inCat.length === 0) continue;
      ns.push({
        id: `sec:${cat.key}`,
        type: 'label',
        position: { x: COL.a, y },
        data: { text: cat.title, tone: 'section', width: laneWidth },
        draggable: false,
        selectable: false,
      });
      y += 34;
      const byLane = { a: [] as MapItem[], both: [] as MapItem[], b: [] as MapItem[] };
      inCat.forEach((i) => byLane[i.lane].push(i));
      const rows = Math.max(byLane.a.length, byLane.both.length, byLane.b.length);
      (['a', 'both', 'b'] as const).forEach((lane) => {
        byLane[lane].forEach((item, idx) => {
          ns.push({
            id: item.id,
            type: 'item',
            position: { x: COL[lane], y: y + idx * (ITEM_H + ROW_GAP) },
            data: { item, names, dim: false, hot: false },
            draggable: false,
            width: ITEM_W,
            height: ITEM_H,
          });
          if (lane !== 'b') {
            es.push({ id: `a->${item.id}`, source: 'person:a', sourceHandle: 'out', target: item.id, targetHandle: 'l', data: { who: 'a' } });
          }
          if (lane !== 'a') {
            es.push({ id: `b->${item.id}`, source: 'person:b', sourceHandle: 'out', target: item.id, targetHandle: 'r', data: { who: 'b' } });
          }
        });
      });
      y += rows * (ITEM_H + ROW_GAP) + 22;
    }

    const total = Math.max(y, PERSON_H + 80);
    const personY = Math.max(44, total / 2 - PERSON_H / 2);
    ns.push(
      {
        id: 'person:a',
        type: 'person',
        position: { x: 0, y: personY },
        data: { who: 'a', name: names.a, email: emails.a, count: counts.a + counts.both, dim: false },
        draggable: false,
        width: PERSON_W,
        height: PERSON_H,
      },
      {
        id: 'person:b',
        type: 'person',
        position: { x: B_X, y: personY },
        data: { who: 'b', name: names.b, email: emails.b, count: counts.b + counts.both, dim: false },
        draggable: false,
        width: PERSON_W,
        height: PERSON_H,
      },
    );
    const lanes: Array<[keyof typeof COL, string, LabelData['tone']]> = [
      ['a', `Only ${names.a}`, 'a'],
      ['both', 'Shared', 'both'],
      ['b', `Only ${names.b}`, 'b'],
    ];
    for (const [lane, text, tone] of lanes) {
      ns.push({
        id: `lane:${lane}`,
        type: 'label',
        position: { x: COL[lane], y: 0 },
        data: { text, tone, width: ITEM_W },
        draggable: false,
        selectable: false,
      });
    }
    return { nodes: ns, edges: es, height: total };
  }, [visible, names, emails, counts]);

  // Hover a person → their lines and items; hover an item → its one or two lines.
  const shown = useMemo(() => {
    const hotEdges = new Set<string>();
    if (hover?.startsWith('person:')) {
      const who = hover.slice(7);
      edges.forEach((e) => (e.data as { who: string }).who === who && hotEdges.add(e.id));
    } else if (hover) {
      edges.forEach((e) => e.target === hover && hotEdges.add(e.id));
    }
    const hotNodes = new Set<string>();
    edges.forEach((e) => {
      if (hotEdges.has(e.id)) {
        hotNodes.add(e.source);
        hotNodes.add(e.target);
      }
    });
    const active = Boolean(hover);
    return {
      nodes: nodes.map((n) =>
        n.type === 'label'
          ? n
          : {
              ...n,
              data: { ...n.data, dim: active && !hotNodes.has(n.id), hot: active && hotNodes.has(n.id) && n.type === 'item' },
            },
      ),
      edges: edges.map((e) => {
        const who = (e.data as { who: Who }).who;
        const hot = hotEdges.has(e.id);
        return {
          ...e,
          type: 'default',
          style: {
            stroke: who === 'a' ? 'var(--cm-a)' : 'var(--cm-b)',
            strokeWidth: hot ? 2.6 : 1.4,
            opacity: active ? (hot ? 1 : 0.08) : 0.3,
          },
          zIndex: hot ? 1 : 0,
        };
      }),
    };
  }, [nodes, edges, hover]);

  useEffect(() => {
    const t = window.setTimeout(() => rf.fitView({ padding: 0.04, maxZoom: 1, duration: 200 }), 40);
    return () => window.clearTimeout(t);
  }, [nodes, rf]);

  const canvasHeight = Math.min(920, Math.max(380, height * 0.82 + 40));
  const total = counts.a + counts.both + counts.b || 1;

  return (
    <div className="cm">
      <div className="cm-overlap" aria-label="Overlap summary">
        <div className="cm-overlap-bar" role="img" aria-label={`${counts.a} only ${names.a}, ${counts.both} shared, ${counts.b} only ${names.b}`}>
          {counts.a > 0 && <span className="cm-seg cm-seg-a" style={{ flexGrow: counts.a }} />}
          {counts.both > 0 && <span className="cm-seg cm-seg-both" style={{ flexGrow: counts.both }} />}
          {counts.b > 0 && <span className="cm-seg cm-seg-b" style={{ flexGrow: counts.b }} />}
        </div>
        <div className="cm-overlap-legend">
          <span>
            <span className="cm-key cm-key-a" /> <strong>{counts.a}</strong> only {names.a}
          </span>
          <span>
            <span className="cm-key cm-key-both" /> <strong>{counts.both}</strong> shared
            {counts.differs > 0 && (
              <>
                {' '}
                (<span className="cm-key cm-key-warn" /> {counts.differs} at different levels)
              </>
            )}
          </span>
          <span>
            <span className="cm-key cm-key-b" /> <strong>{counts.b}</strong> only {names.b}
          </span>
          <span className="cm-overlap-pct">{Math.round((counts.both / total) * 100)}% overlap</span>
        </div>
      </div>

      {productsPresent.length > 0 && (
        <div className="cm-chips" role="group" aria-label="Filter by product">
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
      )}

      <div className="cm-canvas" style={{ height: canvasHeight }}>
        {loading && <div className="ag-loading">Loading resource grants…</div>}
        {visible.length === 0 ? (
          <div className="cm-empty">
            {onlyDiff ? 'No differences — these two users have the same access.' : 'Neither user has any grants here.'}
          </div>
        ) : (
          <ReactFlow
            nodes={shown.nodes}
            edges={shown.edges}
            nodeTypes={nodeTypes}
            colorMode={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
            onNodeMouseEnter={(_, n) => n.type !== 'label' && setHover(n.id)}
            onNodeMouseLeave={() => setHover(null)}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            minZoom={0.3}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} size={1} color="var(--ag-grid)" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
        )}
      </div>
      <p className="cm-hint">
        Hover a person to see everything they have, or an item to see who has it. Click a Team or Worker Group
        to open it.
      </p>
    </div>
  );
}

/** Two-person access map for Access Check: only-A · shared · only-B lanes with lines to each person. */
export function CompareMap(props: CompareMapProps) {
  return (
    <ReactFlowProvider>
      <MapInner {...props} />
    </ReactFlowProvider>
  );
}
