export const PRODUCTS = ['stream', 'edge', 'search', 'lake', 'outpost'] as const;
export type Product = (typeof PRODUCTS)[number];

// Products that have the concept of a "Worker Group" (Fleet for edge, Outpost Group for outpost).
export const CORE_PRODUCTS = ['stream', 'edge', 'outpost'] as const;
export type CoreProduct = (typeof CORE_PRODUCTS)[number];

export interface Paginated<T> {
  count: number;
  items: T[];
}

/** An upstream identity linked to a user account. `kind` says how they authenticate. */
export interface UserIdentity {
  connectionId: string;
  kind: 'OIDC' | 'PASSWORD' | 'SAML' | (string & {});
  subject: string;
}

export interface User {
  id: string;
  username: string;
  first: string;
  last: string;
  email: string;
  disabled: boolean;
  type?: 'user' | 'credential';
  /** Role ids assigned directly to this account, bypassing Teams. */
  roles?: string[];
  /** Team ids this user belongs to. */
  teams?: string[];
  workspaceRoles?: Record<string, { workspaceId: string; roles: string[] }>;
  /** Upstream federated identities (SSO). Absent for purely local accounts. */
  federated_identities?: UserIdentity[];
  /** Cloud-only account metadata. */
  cloudMetadata?: {
    identityType?: 'SINGLE_SIGN_ON' | 'USERNAME_PASSWORD' | (string & {});
    ssoGroups?: string[];
  };

  // --- API Credential (`type: 'credential'`) fields ---
  /** Human description of the API Credential. */
  description?: string;
  /** Email of the user who created it. */
  createdBy?: string;
  /** ISO timestamp it was created. */
  createdDate?: string;
  /** Role the creator held at creation time. */
  creatorRole?: string;
  /** ISO timestamp it was last updated. */
  lastUpdatedDate?: string;
  /** IPs / CIDRs allowed to use the credential. */
  ipAllowList?: string[];
  /** Workspace the credential is scoped to. */
  workspaceName?: string;
  /** True for internal credentials used by Cribl's own services. */
  system?: boolean;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  /** Role ids granted to every member of this team. */
  roles: string[];
  ssoGroupIds?: string[];
  /**
   * Member identifiers sometimes embedded directly on the Team object. Shape
   * varies by deployment (ids / usernames / emails, strings or objects), and
   * some deployments omit it entirely — read defensively, union with the
   * `/system/teams/{id}/users` endpoint.
   */
  members?: unknown;
  users?: unknown;
  memberIds?: unknown;
  userIds?: unknown;
}

export interface Role {
  id: string;
  title?: string;
  description?: string;
  /** Policy ids granted by this role. */
  policy: string[];
  tags?: string[];
}

export interface ConfigGroup {
  id: string;
  name?: string;
  description?: string;
  /** Product this group belongs to, set by `fetchAllGroups` from the endpoint it was read from. */
  product?: CoreProduct;
}

export const RBAC_RESOURCE_TYPES = [
  'groups',
  'datasets',
  'dataset-providers',
  'projects',
  'dashboards',
  'macros',
  'notebooks',
  'notebook-templates',
  'apps',
] as const;
export type RbacResourceType = (typeof RBAC_RESOURCE_TYPES)[number];

export interface ResourcePolicy {
  /** Id of the Worker Group / Fleet / Outpost Group that owns the resource. */
  gid: string;
  /** Resource id. Omitted when `type` is "groups" (the resource *is* the group). */
  id?: string;
  type: RbacResourceType;
  policy: string;
}

/** Source of a role in a user's effective role set. */
export type RoleSource = { kind: 'direct' } | { kind: 'team'; team: Team } | { kind: 'workspace'; workspaceId: string };

export interface EffectiveRole {
  role: Role;
  sources: RoleSource[];
}

export interface UserAclEntry {
  product: Product;
  entries: ResourcePolicy[];
}

export interface UserAclResult {
  /** Per-product results for products that answered successfully. */
  byProduct: UserAclEntry[];
  /** Products that errored or aren't available to this app/user; shown as silently omitted, not failed. */
  unavailableProducts: Product[];
}

export interface UserAccess {
  teams: Team[];
  effectiveRoles: EffectiveRole[];
}

/** Display name for each Cribl product. */
export const PRODUCT_LABELS: Record<Product, string> = {
  stream: 'Stream',
  edge: 'Edge',
  search: 'Search',
  lake: 'Lake',
  outpost: 'Outpost',
};

/** Human label for the kind of group a `gid` refers to, keyed by owning product. */
export const GROUP_KIND_LABELS: Record<string, string> = {
  stream: 'Worker Group',
  edge: 'Fleet',
  outpost: 'Outpost Group',
};

/** Where a grant in a User's resolved access came from: assigned directly, inherited from a Team, or from a Workspace-scoped role. */
export type AccessSource =
  | { kind: 'direct' }
  | { kind: 'team'; teamId: string; teamName: string }
  | { kind: 'workspace'; workspaceId: string };

/** Group-level access to one group, with its effective policy and where it came from. */
export interface GroupGrant {
  policy: string;
  sources: AccessSource[];
}

/** One resource-level grant (dataset, dashboard, …) within a group, with its effective policy and origin. */
export interface ResourceGrant {
  type: RbacResourceType;
  /** Resource id. */
  id?: string;
  policy: string;
  sources: AccessSource[];
}

/**
 * One Worker Group / Fleet / Outpost Group a principal (User or Team) can reach,
 * collapsed from the raw `ResourcePolicy[]` of one or more ACL sources — the
 * principal's own ACL plus, for a User, each Team they belong to.
 */
export interface GroupAccess {
  /** Group id — the `gid` carried on the ACL entries. */
  gid: string;
  /** Owning product, when known. User ACLs are fetched per-product; the Team ACL is not, so this may be undefined. */
  product?: Product;
  /** Access to the group itself (from the `type: 'groups'` entry). `null` when only resources inside the group are reachable. */
  groupPolicy: GroupGrant | null;
  /** Resource-level grants scoped to this group (datasets, dashboards, …). */
  resourcePolicies: ResourceGrant[];
}

/** A Team's resolved resource access. Tolerant: `unavailable` is true when the ACL endpoint could not be read at all. */
export interface TeamAclResult {
  entries: ResourcePolicy[];
  unavailable: boolean;
}

export interface TeamAccess {
  roles: Role[];
  members: User[];
  /**
   * Identifiers the Team-membership source returned that don't match any
   * account in the roster (e.g. an SSO user who has never signed in to a
   * product and so isn't listed by the per-product user endpoints).
   */
  unresolvedMembers: string[];
  /**
   * False when the `/system/teams/{id}/users` call failed — the member list is
   * then only what could be inferred from user records / the Team object and may
   * be incomplete.
   */
  membershipListComplete: boolean;
}

/** One principal's row in a Worker Group's access list (from the group-centric ACL endpoints). */
export interface GroupAclEntry {
  /** User id/username, or Team id/name — resolve against the roster before display. */
  principal: string;
  perms: ResourcePolicy[];
}

/** The reverse lookup for one Worker Group / Fleet: who has access, directly and via Teams. */
export interface GroupAclResult {
  users: GroupAclEntry[];
  teams: GroupAclEntry[];
  /** True when neither the user nor the team ACL for this group could be read. */
  unavailable: boolean;
}
