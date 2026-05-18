// ── RBAC Permission Types ────────────────────────────────────────────────────
// Role → Scope → Resource model, inspired by n8n's @n8n/permissions package.
// Designed for Desygn AI team workspace and enterprise features.

// Scopes — granular permissions (resource:action format)
export type Scope =
  | 'project:read'   | 'project:write'   | 'project:delete'  | 'project:manage'
  | 'audit:read'     | 'audit:write'      | 'audit:execute'
  | 'issue:read'     | 'issue:create'     | 'issue:close'
  | 'design:read'    | 'design:write'     | 'design:export'
  | 'agent:read'     | 'agent:configure'  | 'agent:execute'
  | 'team:read'      | 'team:manage'      | 'team:invite'
  | 'billing:read'   | 'billing:manage'
  | 'settings:read'  | 'settings:write';

// Global roles — workspace-level membership
export type GlobalRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';

// Project roles — per-project membership that extends global role
export type ProjectRole =
  | 'project:owner'
  | 'project:editor'
  | 'project:reviewer'
  | 'project:viewer';

export type Role = GlobalRole | ProjectRole;

// ScopeRecord for combining global + project scopes
export interface ScopeRecord {
  global: Scope[];
  project: Scope[];
}

// Full result of a permission check
export interface PermissionCheck {
  allowed: boolean;
  missingScopes: Scope[];
  role: Role;
}
