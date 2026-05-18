// ── Core Permission Functions ────────────────────────────────────────────────
// Pure functions, no side effects, no external dependencies.

import { GLOBAL_ROLE_SCOPES, PROJECT_ROLE_SCOPES } from './role-scopes';
import type { GlobalRole, PermissionCheck, ProjectRole, Role, Scope } from './types';

// ── Internal helpers ─────────────────────────────────────────────────────────

function isGlobalRole(role: Role): role is GlobalRole {
  return role in GLOBAL_ROLE_SCOPES;
}

function isProjectRole(role: Role): role is ProjectRole {
  return role in PROJECT_ROLE_SCOPES;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all scopes granted to a role.
 * For global roles uses GLOBAL_ROLE_SCOPES; for project roles uses PROJECT_ROLE_SCOPES.
 */
export function getRoleScopes(role: Role): Scope[] {
  if (isGlobalRole(role)) {
    return GLOBAL_ROLE_SCOPES[role];
  }
  if (isProjectRole(role)) {
    return PROJECT_ROLE_SCOPES[role];
  }
  return [];
}

/**
 * Returns true if the role has the specified scope.
 */
export function hasScope(role: Role, scope: Scope): boolean {
  return getRoleScopes(role).includes(scope);
}

/**
 * Returns true if the role has ALL of the specified scopes.
 */
export function hasAllScopes(role: Role, scopes: Scope[]): boolean {
  const roleScopes = getRoleScopes(role);
  return scopes.every((s) => roleScopes.includes(s));
}

/**
 * Returns true if the role has AT LEAST ONE of the specified scopes.
 */
export function hasAnyScope(role: Role, scopes: Scope[]): boolean {
  const roleScopes = getRoleScopes(role);
  return scopes.some((s) => roleScopes.includes(s));
}

/**
 * Merges global + optional project scopes into a single deduplicated array.
 * Project roles can grant additional scopes beyond the global role.
 */
export function combineScopes(
  globalRole: GlobalRole,
  projectRole?: ProjectRole,
): Scope[] {
  const globalScopes = GLOBAL_ROLE_SCOPES[globalRole];
  if (!projectRole) {
    return [...globalScopes];
  }
  const projectScopes = PROJECT_ROLE_SCOPES[projectRole];
  const combined = new Set<Scope>([...globalScopes, ...projectScopes]);
  return Array.from(combined);
}

/**
 * Full permission check: returns whether all required scopes are present,
 * a list of any missing scopes, and the role being evaluated.
 */
export function checkPermission(role: Role, requiredScopes: Scope[]): PermissionCheck {
  const roleScopes = getRoleScopes(role);
  const missingScopes = requiredScopes.filter((s) => !roleScopes.includes(s));
  return {
    allowed: missingScopes.length === 0,
    missingScopes,
    role,
  };
}

/**
 * Returns a map of CRUD-style booleans for a given resource prefix.
 * E.g. getResourcePermissions('admin', 'project') → { read, write, delete, manage }
 *
 * The `resource` parameter should match the prefix used in Scope (before the colon).
 */
export function getResourcePermissions(
  role: Role,
  resource: string,
): Record<string, boolean> {
  const roleScopes = getRoleScopes(role);
  const actions = ['read', 'write', 'delete', 'manage', 'create', 'execute', 'export', 'configure', 'invite', 'close'] as const;
  const result: Record<string, boolean> = {};

  for (const action of actions) {
    const scope = `${resource}:${action}` as Scope;
    // Only include actions that are defined on the Scope type and present in the role
    result[action] = roleScopes.includes(scope);
  }

  // Remove actions that are always false AND are not semantically relevant to this resource
  // (keep the map clean — only emit keys that have at least one true value OR are standard CRUD)
  const standardCrud = ['read', 'write', 'delete', 'manage'] as const;
  const output: Record<string, boolean> = {};
  for (const action of standardCrud) {
    output[action] = result[action] ?? false;
  }
  // Merge any non-standard actions that are actually true for this resource
  for (const action of actions) {
    if (!standardCrud.includes(action as (typeof standardCrud)[number]) && result[action]) {
      output[action] = true;
    }
  }

  return output;
}
