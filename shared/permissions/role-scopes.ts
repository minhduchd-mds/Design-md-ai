// ── Role → Scope Mappings ────────────────────────────────────────────────────
// Hierarchical: each higher role includes all scopes of lower roles.
// owner > admin > member > viewer > guest

import type { GlobalRole, ProjectRole, Scope } from './types';

// ── Global role scopes ───────────────────────────────────────────────────────

/** Scopes available to the workspace guest (minimal read-only). */
const GUEST_SCOPES: Scope[] = [
  'project:read',
  'design:read',
  'issue:read',
];

/** Scopes available to a workspace viewer (read-only across resources). */
const VIEWER_SCOPES: Scope[] = [
  ...GUEST_SCOPES,
  'audit:read',
  'agent:read',
  'team:read',
  'settings:read',
  'billing:read',
];

/** Scopes available to a regular workspace member (read + write, no management). */
const MEMBER_SCOPES: Scope[] = [
  ...VIEWER_SCOPES,
  'project:write',
  'audit:write',
  'audit:execute',
  'issue:create',
  'issue:close',
  'design:write',
  'design:export',
  'agent:execute',
];

/** Scopes available to a workspace admin (all member + management, minus billing:manage). */
const ADMIN_SCOPES: Scope[] = [
  ...MEMBER_SCOPES,
  'project:delete',
  'project:manage',
  'agent:configure',
  'team:manage',
  'team:invite',
  'settings:write',
  'billing:read',    // already included via viewer but explicit for clarity
];

/** Scopes available to the workspace owner (all scopes including billing management). */
const OWNER_SCOPES: Scope[] = [
  ...ADMIN_SCOPES,
  'billing:manage',
];

/**
 * Maps each global role to its full set of scopes.
 * Higher roles include all scopes of lower roles (hierarchical).
 */
export const GLOBAL_ROLE_SCOPES: Record<GlobalRole, Scope[]> = {
  owner:  OWNER_SCOPES,
  admin:  ADMIN_SCOPES,
  member: MEMBER_SCOPES,
  viewer: VIEWER_SCOPES,
  guest:  GUEST_SCOPES,
};

// ── Project role scopes ──────────────────────────────────────────────────────

/** Scopes for a project-level viewer (read-only within the project context). */
const PROJECT_VIEWER_SCOPES: Scope[] = [
  'project:read',
  'design:read',
  'audit:read',
  'issue:read',
];

/** Scopes for a project-level reviewer (can comment/close issues, read all). */
const PROJECT_REVIEWER_SCOPES: Scope[] = [
  ...PROJECT_VIEWER_SCOPES,
  'issue:create',
  'issue:close',
  'audit:execute',
];

/** Scopes for a project-level editor (full read/write within the project). */
const PROJECT_EDITOR_SCOPES: Scope[] = [
  ...PROJECT_REVIEWER_SCOPES,
  'project:write',
  'audit:write',
  'design:write',
  'design:export',
  'agent:execute',
];

/** Scopes for a project-level owner (full control over the project). */
const PROJECT_OWNER_SCOPES: Scope[] = [
  ...PROJECT_EDITOR_SCOPES,
  'project:delete',
  'project:manage',
  'agent:configure',
  'team:invite',
];

/**
 * Maps each project role to its full set of scopes.
 * These scopes apply within the context of a specific project and are
 * combined with (and may extend) the user's global role scopes.
 */
export const PROJECT_ROLE_SCOPES: Record<ProjectRole, Scope[]> = {
  'project:owner':    PROJECT_OWNER_SCOPES,
  'project:editor':   PROJECT_EDITOR_SCOPES,
  'project:reviewer': PROJECT_REVIEWER_SCOPES,
  'project:viewer':   PROJECT_VIEWER_SCOPES,
};
