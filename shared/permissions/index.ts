// ── RBAC Permissions Module ──────────────────────────────────────────────────
// Barrel file — re-exports all public types and functions.

export type { GlobalRole, PermissionCheck, ProjectRole, Role, Scope, ScopeRecord } from './types';
export { GLOBAL_ROLE_SCOPES, PROJECT_ROLE_SCOPES } from './role-scopes';
export {
  checkPermission,
  combineScopes,
  getResourcePermissions,
  getRoleScopes,
  hasAllScopes,
  hasAnyScope,
  hasScope,
} from './permissions';
