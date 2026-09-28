import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Checkbox, EmptyState, Spinner, Tag, Text } from '@capra/core';
import {
  PRODUCT_LABELS,
  type GroupAccess,
  type Team,
  type TeamAclResult,
  type User,
  type UserAccess,
  type UserAclResult,
} from '../api/types';
import { PRODUCT_ACCESS_KEYS, computeProductAccess, levelRank } from '../api/productAccess';
import { productForRoleId, resolveGroupAdminReach, type GroupAdminReach } from '../api/access';
import { describeAuth } from '../api/overview';
import {
  formatPolicy,
  groupKindLabel,
  policyRank,
  resourceLabel,
  summarizeGroupAccess,
} from '../api/acl';
import { useRbacData } from '../context/RbacDataContext';
import { useUserAcl } from '../hooks/useUserAcl';
import { useTeamAcls } from '../hooks/useTeamAcl';
import { DetailSection } from './DetailSection';
import { AuthBadge } from './AuthBadge';
import { TagLink } from './TagLink';
import { groupsBySource } from '../viz/accessGraph';
import { buildCompareMap } from '../viz/compareMap';
import { LEVEL_BUCKET_BY_KEY, levelBucket } from '../viz/levels';
import { LazyCompareMap as CompareMap } from './graph/LazyCompareMap';
import { ViewToggle } from './graph/ViewToggle';
import { useDetailView } from './graph/useDetailView';
import { ProductIcon } from './shell/ProductIcon';
import './CompareView.css';

interface CompareViewProps {
  userA: User;
  userB: User;
  accessA: UserAccess;
  accessB: UserAccess;
}

function userName(user: User): string {
  return [user.first, user.last].filter(Boolean).join(' ') || user.username || user.id;
}

const norm = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

/** One row of the side-by-side tables. */
function Row({
  label,
  a,
  b,
  differ,
  hint,
}: {
  label: ReactNode;
  a: ReactNode;
  b: ReactNode;
  differ: boolean;
  hint?: ReactNode;
}) {
  return (
    <tr className={differ ? 'compare-row compare-row-diff' : 'compare-row'}>
      <th scope="row">
        <span className="compare-row-label">{label}</span>
        {hint && (
          <Text as="div" color="secondary" variant="body-xs-normal">
            {hint}
          </Text>
        )}
      </th>
      <td>{a}</td>
      <td>{b}</td>
    </tr>
  );
}

function ChipGroup({ title, children, count }: { title: string; count: number; children: ReactNode }) {
  return (
    <div className="compare-chip-group">
      <Text color="secondary" variant="body-sm-semibold">
        {title} <span className="compare-chip-count">{count}</span>
      </Text>
      {count === 0 ? (
        <Text color="secondary" variant="body-sm-normal">
          None.
        </Text>
      ) : (
        <div className="chip-row">{children}</div>
      )}
    </div>
  );
}

function buildGroupAccess(
  acl: UserAclResult | null,
  teamAcls: Map<string, TeamAclResult> | null,
  teams: Team[],
): GroupAccess[] | null {
  if (!acl || !teamAcls) return null;
  return summarizeGroupAccess([
    ...acl.byProduct.map((entry) => ({ product: entry.product, entries: entry.entries })),
    ...teams.flatMap((team) => {
      const ta = teamAcls.get(team.id);
      return ta && !ta.unavailable
        ? [{ entries: ta.entries, via: { kind: 'team' as const, teamId: team.id, teamName: team.name } }]
        : [];
    }),
  ]);
}

const isFullAdmin = (reach: GroupAdminReach[]) =>
  reach.some((g) => g.scope === 'org' || g.scope === 'workspace');

function adminLabel(reach: GroupAdminReach[]): string {
  const org = reach.find((g) => g.scope === 'org');
  if (org) return org.owner ? 'Organization owner' : 'Organization admin';
  const ws = reach.find((g) => g.scope === 'workspace');
  if (ws) return ws.owner ? 'Workspace owner' : 'Workspace admin';
  return 'Admin';
}

interface ResourceRow {
  key: string;
  groupTitle: string;
  groupKind: string;
  resource: string | null;
  a: string | null;
  b: string | null;
}

export function CompareView({ userA, userB, accessA, accessB }: CompareViewProps) {
  const { groupById } = useRbacData();
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [view, setView] = useDetailView();

  const nameA = userName(userA);
  const nameB = userName(userB);

  const paA = useMemo(() => computeProductAccess(userA, accessA.effectiveRoles), [userA, accessA]);
  const paB = useMemo(() => computeProductAccess(userB, accessB.effectiveRoles), [userB, accessB]);

  const adminA = useMemo(
    () => resolveGroupAdminReach(userA, accessA.effectiveRoles),
    [userA, accessA],
  );
  const adminB = useMemo(
    () => resolveGroupAdminReach(userB, accessB.effectiveRoles),
    [userB, accessB],
  );

  // --- Resource access (async) ---------------------------------------------
  const aclA = useUserAcl(userA.id);
  const aclB = useUserAcl(userB.id);
  const teamIdsA = useMemo(() => accessA.teams.map((t) => t.id), [accessA.teams]);
  const teamIdsB = useMemo(() => accessB.teams.map((t) => t.id), [accessB.teams]);
  const teamAclsA = useTeamAcls(teamIdsA);
  const teamAclsB = useTeamAcls(teamIdsB);

  const groupsA = useMemo(
    () => buildGroupAccess(aclA.data, teamAclsA.data, accessA.teams),
    [aclA.data, teamAclsA.data, accessA.teams],
  );
  const groupsB = useMemo(
    () => buildGroupAccess(aclB.data, teamAclsB.data, accessB.teams),
    [aclB.data, teamAclsB.data, accessB.teams],
  );

  // --- Teams diff ---------------------------------------------------------
  const teamIdSetA = new Set(teamIdsA);
  const teamIdSetB = new Set(teamIdsB);
  const teamsBoth = accessA.teams.filter((t) => teamIdSetB.has(t.id));
  const teamsOnlyA = accessA.teams.filter((t) => !teamIdSetB.has(t.id));
  const teamsOnlyB = accessB.teams.filter((t) => !teamIdSetA.has(t.id));

  // --- Roles diff -------------------------------------------------------
  const rolesA = new Map(accessA.effectiveRoles.map((r) => [r.role.id, r]));
  const rolesB = new Map(accessB.effectiveRoles.map((r) => [r.role.id, r]));
  const roleIds = [...new Set([...rolesA.keys(), ...rolesB.keys()])];
  const rolesBoth = roleIds.filter((id) => rolesA.has(id) && rolesB.has(id));
  const rolesOnlyA = roleIds.filter((id) => rolesA.has(id) && !rolesB.has(id));
  const rolesOnlyB = roleIds.filter((id) => rolesB.has(id) && !rolesA.has(id));
  const roleLabel = (id: string) => {
    const r = rolesA.get(id) ?? rolesB.get(id)!;
    const p = productForRoleId(r.role.id);
    return p ? `${r.role.title || r.role.id} · ${PRODUCT_LABELS[p]}` : r.role.title || r.role.id;
  };

  // --- Product-access rows ---------------------------------------------
  const productRows = PRODUCT_ACCESS_KEYS.map((key) => {
    const label = key === 'workspace' ? 'Workspace' : PRODUCT_LABELS[key];
    const la = paA.levels[key];
    const lb = paB.levels[key];
    const differ = norm(la) !== norm(lb);
    return { key, label, la, lb, differ };
  });
  const productDiffCount = productRows.filter((r) => r.differ).length;

  // --- Resource-access rows ------------------------------------------
  const resourceLoading =
    aclA.loading || aclB.loading || teamAclsA.loading || teamAclsB.loading || !groupsA || !groupsB;

  const resourceRows = useMemo<ResourceRow[]>(() => {
    if (!groupsA || !groupsB) return [];
    const fullA = isFullAdmin(adminA);
    const fullB = isFullAdmin(adminB);
    const byGidA = new Map(groupsA.map((g) => [g.gid, g]));
    const byGidB = new Map(groupsB.map((g) => [g.gid, g]));
    const gids = [...new Set([...byGidA.keys(), ...byGidB.keys()])];

    const rows: ResourceRow[] = [];
    for (const gid of gids) {
      const ga = byGidA.get(gid);
      const gb = byGidB.get(gid);
      const meta = groupById.get(gid);
      const product = ga?.product ?? gb?.product ?? meta?.product;
      const groupTitle = meta?.name ?? gid;
      const groupKind = groupKindLabel(product);

      const groupPolicyA = fullA ? 'Admin' : ga?.groupPolicy ? formatPolicy(ga.groupPolicy.policy) : null;
      const groupPolicyB = fullB ? 'Admin' : gb?.groupPolicy ? formatPolicy(gb.groupPolicy.policy) : null;
      if (groupPolicyA || groupPolicyB) {
        rows.push({ key: gid, groupTitle, groupKind, resource: null, a: groupPolicyA, b: groupPolicyB });
      }

      const resKeys = [
        ...new Set([
          ...(ga?.resourcePolicies ?? []).map((r) => `${r.type}::${r.id ?? ''}`),
          ...(gb?.resourcePolicies ?? []).map((r) => `${r.type}::${r.id ?? ''}`),
        ]),
      ];
      for (const rk of resKeys) {
        const [type, id] = rk.split('::');
        const ra = ga?.resourcePolicies.find((r) => `${r.type}::${r.id ?? ''}` === rk);
        const rb = gb?.resourcePolicies.find((r) => `${r.type}::${r.id ?? ''}` === rk);
        rows.push({
          key: `${gid}::${rk}`,
          groupTitle,
          groupKind,
          resource: resourceLabel(type, id || undefined),
          a: fullA ? 'Maintainer' : ra ? formatPolicy(ra.policy) : null,
          b: fullB ? 'Maintainer' : rb ? formatPolicy(rb.policy) : null,
        });
      }
    }
    return rows.sort(
      (x, y) =>
        x.groupTitle.localeCompare(y.groupTitle) ||
        Number(x.resource !== null) - Number(y.resource !== null) ||
        (x.resource ?? '').localeCompare(y.resource ?? ''),
    );
  }, [groupsA, groupsB, adminA, adminB, groupById]);

  const resourceDiffRows = resourceRows.filter((r) => norm(r.a) !== norm(r.b));

  const missingProductsNote = useMemo(() => {
    const set = new Set<string>();
    for (const p of aclA.data?.unavailableProducts ?? []) set.add(PRODUCT_LABELS[p] ?? p);
    for (const p of aclB.data?.unavailableProducts ?? []) set.add(PRODUCT_LABELS[p] ?? p);
    return set.size > 0 ? `Couldn't read resource access for ${[...set].join(', ')}.` : null;
  }, [aclA.data, aclB.data]);

  const policyTag = (value: string | null, lead = false) =>
    value ? (
      <span className="compare-value">
        {lead && (
          <span className="compare-lead" title="Higher access" aria-label="Higher access">
            ▲
          </span>
        )}
        <Tag color="success" size="sm">
          {value}
        </Tag>
      </span>
    ) : (
      <Text color="secondary" variant="body-sm-normal">
        —
      </Text>
    );

  const levelTag = (value: string | null, lead = false) => {
    if (!value) {
      return (
        <Text color="secondary" variant="body-sm-normal">
          —
        </Text>
      );
    }
    const none = value.toLowerCase() === 'no access';
    return (
      <span className="compare-value">
        {lead && (
          <span className="compare-lead" title="Higher access" aria-label="Higher access">
            ▲
          </span>
        )}
        <Tag color={none ? 'default' : 'success'} size="sm">
          {value}
        </Tag>
      </span>
    );
  };

  /** -1 = equal / not comparable, 0 = A leads, 1 = B leads. */
  const leader = (a: string | null, b: string | null): number => {
    const ra = a ? levelRank(a) : -1;
    const rb = b ? levelRank(b) : -1;
    if (ra === rb || ra < 0 || rb < 0) return -1;
    return ra > rb ? 0 : 1;
  };

  const mapItems = useMemo(
    () =>
      buildCompareMap(
        { access: accessA, bySource: groupsBySource(aclA.data, teamAclsA.data, accessA.teams), adminReach: adminA },
        { access: accessB, bySource: groupsBySource(aclB.data, teamAclsB.data, accessB.teams), adminReach: adminB },
        groupById,
      ),
    [accessA, accessB, aclA.data, aclB.data, teamAclsA.data, teamAclsB.data, adminA, adminB, groupById],
  );


  return (
    <div className="compare-view">
      <div className="compare-toolbar">
        <Text color="secondary" variant="body-sm-normal">
          {productDiffCount === 0 && teamsOnlyA.length + teamsOnlyB.length === 0 && rolesOnlyA.length + rolesOnlyB.length === 0
            ? 'These two users have the same roles, teams, and product access.'
            : `${productDiffCount} product level${productDiffCount === 1 ? '' : 's'} differ · ` +
              `${teamsOnlyA.length + teamsOnlyB.length} team${teamsOnlyA.length + teamsOnlyB.length === 1 ? '' : 's'} not shared · ` +
              `${rolesOnlyA.length + rolesOnlyB.length} role${rolesOnlyA.length + rolesOnlyB.length === 1 ? '' : 's'} not shared`}
        </Text>
        <div className="compare-toolbar-right">
          <Checkbox checked={onlyDiff} onChange={() => setOnlyDiff((v) => !v)}>
            Show only differences
          </Checkbox>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>


      {view === 'graph' ? (
        <>
          <section className="glass-card compare-matrix-card" aria-label="Product access matrix">
            <table className="compare-matrix">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">{nameA}</th>
                  <th scope="col">{nameB}</th>
                </tr>
              </thead>
              <tbody>
                {productRows
                  .filter((r) => !onlyDiff || r.differ)
                  .map((r) => {
                    const lead = leader(r.la, r.lb);
                    const cell = (level: string | null, isLead: boolean) => {
                      const b = LEVEL_BUCKET_BY_KEY[levelBucket(level)];
                      return (
                        <td>
                          <span className={`matrix-cell${isLead ? ' matrix-cell-lead' : ''}`}>
                            <span className="matrix-bar" style={{ background: b.cssVar }} aria-hidden />
                            {level ?? '—'}
                            {isLead && <span className="matrix-lead">▲ higher</span>}
                          </span>
                        </td>
                      );
                    };
                    return (
                      <tr key={r.key} className={r.differ ? 'matrix-row-diff' : undefined}>
                        <th scope="row">
                          <span className="matrix-product">
                            {r.key !== 'workspace' && <ProductIcon product={r.key} size="sm" />}
                            {r.label}
                          </span>
                        </th>
                        {cell(r.la, lead === 0)}
                        {cell(r.lb, lead === 1)}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>
          <section className="glass-card compare-graph-card" aria-label="Access map">
            <CompareMap
              items={mapItems}
              names={{ a: nameA, b: nameB }}
              emails={{ a: userA.email || userA.username, b: userB.email || userB.username }}
              onlyDiff={onlyDiff}
              loading={resourceLoading}
            />
          </section>
        </>
      ) : (
      <>

      <DetailSection title="Identity">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col" className="compare-corner" />
              <th scope="col">{nameA}</th>
              <th scope="col">{nameB}</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Email" a={userA.email || '—'} b={userB.email || '—'} differ={false} />
            <Row
              label="Signs in"
              a={<AuthBadge user={userA} />}
              b={<AuthBadge user={userB} />}
              differ={describeAuth(userA).label !== describeAuth(userB).label}
            />
            <Row
              label="Status"
              a={userA.disabled ? <Tag color="danger" size="sm">Disabled</Tag> : 'Active'}
              b={userB.disabled ? <Tag color="danger" size="sm">Disabled</Tag> : 'Active'}
              differ={Boolean(userA.disabled) !== Boolean(userB.disabled)}
            />
            <Row
              label="Organization admin"
              a={paA.isOrgAdmin ? 'Yes' : 'No'}
              b={paB.isOrgAdmin ? 'Yes' : 'No'}
              differ={paA.isOrgAdmin !== paB.isOrgAdmin}
            />
            <Row
              label="Teams"
              a={String(accessA.teams.length)}
              b={String(accessB.teams.length)}
              differ={accessA.teams.length !== accessB.teams.length}
            />
            <Row
              label="Effective roles"
              a={String(accessA.effectiveRoles.length)}
              b={String(accessB.effectiveRoles.length)}
              differ={accessA.effectiveRoles.length !== accessB.effectiveRoles.length}
            />
          </tbody>
        </table>
      </DetailSection>

      <DetailSection title="Product access">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col" className="compare-corner" />
              <th scope="col">{nameA}</th>
              <th scope="col">{nameB}</th>
            </tr>
          </thead>
          <tbody>
            {productRows
              .filter((r) => !onlyDiff || r.differ)
              .map((r) => {
                const lead = leader(r.la, r.lb);
                return (
                  <Row
                    key={r.key}
                    label={r.label}
                    a={levelTag(r.la, lead === 0)}
                    b={levelTag(r.lb, lead === 1)}
                    differ={r.differ}
                  />
                );
              })}
            {onlyDiff && productDiffCount === 0 && (
              <tr>
                <td colSpan={3}>
                  <Text color="secondary" variant="body-sm-normal">
                    Product access is identical.
                  </Text>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </DetailSection>

      <DetailSection title="Teams" count={teamsBoth.length + teamsOnlyA.length + teamsOnlyB.length}>
        <div className="compare-groups">
          {!onlyDiff && (
            <ChipGroup title="Both users" count={teamsBoth.length}>
              {teamsBoth.map((t) => (
                <TagLink key={t.id} to={`/teams/${encodeURIComponent(t.id)}`}>
                  {t.name}
                </TagLink>
              ))}
            </ChipGroup>
          )}
          <ChipGroup title={`Only ${nameA}`} count={teamsOnlyA.length}>
            {teamsOnlyA.map((t) => (
              <TagLink key={t.id} to={`/teams/${encodeURIComponent(t.id)}`} color="warning">
                {t.name}
              </TagLink>
            ))}
          </ChipGroup>
          <ChipGroup title={`Only ${nameB}`} count={teamsOnlyB.length}>
            {teamsOnlyB.map((t) => (
              <TagLink key={t.id} to={`/teams/${encodeURIComponent(t.id)}`} color="warning">
                {t.name}
              </TagLink>
            ))}
          </ChipGroup>
        </div>
      </DetailSection>

      <DetailSection title="Effective roles" count={roleIds.length}>
        <div className="compare-groups">
          {!onlyDiff && (
            <ChipGroup title="Both users" count={rolesBoth.length}>
              {rolesBoth.map((id) => (
                <Tag key={id} color="brand">
                  {roleLabel(id)}
                </Tag>
              ))}
            </ChipGroup>
          )}
          <ChipGroup title={`Only ${nameA}`} count={rolesOnlyA.length}>
            {rolesOnlyA.map((id) => (
              <Tag key={id} color="warning">
                {roleLabel(id)}
              </Tag>
            ))}
          </ChipGroup>
          <ChipGroup title={`Only ${nameB}`} count={rolesOnlyB.length}>
            {rolesOnlyB.map((id) => (
              <Tag key={id} color="warning">
                {roleLabel(id)}
              </Tag>
            ))}
          </ChipGroup>
        </div>
      </DetailSection>

      <DetailSection title="Resource access">
        {(isFullAdmin(adminA) || isFullAdmin(adminB)) && (
          <Alert appearance="info" layout="inline" title="Inherited admin access">
            {isFullAdmin(adminA) && (
              <div>
                {nameA} has Admin on every Worker Group and resource ({adminLabel(adminA)}).
              </div>
            )}
            {isFullAdmin(adminB) && (
              <div>
                {nameB} has Admin on every Worker Group and resource ({adminLabel(adminB)}).
              </div>
            )}
          </Alert>
        )}
        {resourceLoading ? (
          <div className="compare-loading">
            <Spinner size="sm" title="Loading resource access…" />
          </div>
        ) : resourceRows.length === 0 ? (
          isFullAdmin(adminA) || isFullAdmin(adminB) ? (
            <Text color="secondary" variant="body-sm-normal">
              No explicit Worker Group or resource grants to compare — the inherited admin access
              above covers everything.
            </Text>
          ) : (
            <EmptyState
              size="md"
              title="No resolved resource access"
              description="Neither user has a Worker Group, Fleet, or resource-level grant on the products this app can check."
            />
          )
        ) : (
          <>
            <table className="compare-table access-compare">
              <thead>
                <tr>
                  <th scope="col">Group / Resource</th>
                  <th scope="col">{nameA}</th>
                  <th scope="col">{nameB}</th>
                </tr>
              </thead>
              <tbody>
                {(onlyDiff ? resourceDiffRows : resourceRows).map((r) => {
                  const ra = policyRank(r.a);
                  const rb = policyRank(r.b);
                  const differ = norm(r.a) !== norm(r.b);
                  return (
                    <Row
                      key={r.key}
                      label={r.resource ?? r.groupTitle}
                      hint={r.resource ? r.groupTitle : r.groupKind}
                      a={policyTag(r.a, differ && ra > rb)}
                      b={policyTag(r.b, differ && rb > ra)}
                      differ={differ}
                    />
                  );
                })}
                {onlyDiff && resourceDiffRows.length === 0 && (
                  <tr>
                    <td colSpan={3}>
                      <Text color="secondary" variant="body-sm-normal">
                        Resolved resource access is identical.
                      </Text>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {missingProductsNote && (
              <Text color="secondary" variant="body-sm-normal">
                {missingProductsNote}
              </Text>
            )}
          </>
        )}
      </DetailSection>
      </>
      )}
    </div>
  );
}
