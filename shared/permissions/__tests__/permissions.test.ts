import { describe, expect, it } from 'vitest';
import {
  GLOBAL_ROLE_SCOPES,
  PROJECT_ROLE_SCOPES,
  checkPermission,
  combineScopes,
  getResourcePermissions,
  getRoleScopes,
  hasAllScopes,
  hasAnyScope,
  hasScope,
} from '../index';
import type { Scope } from '../types';

// ── getRoleScopes ─────────────────────────────────────────────────────────────

describe('getRoleScopes', () => {
  it('returns all scopes for owner — the largest set', () => {
    const scopes = getRoleScopes('owner');
    expect(scopes).toContain('billing:manage');
    expect(scopes).toContain('project:delete');
    expect(scopes).toContain('team:manage');
    expect(scopes.length).toBeGreaterThan(0);
  });

  it('returns scopes for a project role', () => {
    const scopes = getRoleScopes('project:editor');
    expect(scopes).toContain('design:write');
    expect(scopes).toContain('project:write');
  });

  it('returns an empty array for an unrecognised role', () => {
    // Cast to Role to simulate a runtime value from an unknown source
    const scopes = getRoleScopes('superuser' as never);
    expect(scopes).toEqual([]);
  });
});

// ── Role hierarchy checks ─────────────────────────────────────────────────────

describe('owner role', () => {
  it('has ALL defined scopes', () => {
    const allScopes = Object.values(GLOBAL_ROLE_SCOPES).flat();
    const ownerScopes = getRoleScopes('owner');
    const unique = [...new Set(allScopes)];
    for (const scope of unique) {
      expect(ownerScopes).toContain(scope);
    }
  });

  it('has billing:manage', () => {
    expect(hasScope('owner', 'billing:manage')).toBe(true);
  });
});

describe('admin role', () => {
  it('has all member scopes', () => {
    const memberScopes = getRoleScopes('member');
    expect(hasAllScopes('admin', memberScopes)).toBe(true);
  });

  it('does NOT have billing:manage', () => {
    expect(hasScope('admin', 'billing:manage')).toBe(false);
  });

  it('has team:manage and settings:write', () => {
    expect(hasScope('admin', 'team:manage')).toBe(true);
    expect(hasScope('admin', 'settings:write')).toBe(true);
  });
});

describe('member role', () => {
  it('has read and write scopes for core resources', () => {
    expect(hasScope('member', 'project:read')).toBe(true);
    expect(hasScope('member', 'project:write')).toBe(true);
    expect(hasScope('member', 'design:write')).toBe(true);
  });

  it('does NOT have project:manage or project:delete', () => {
    expect(hasScope('member', 'project:manage')).toBe(false);
    expect(hasScope('member', 'project:delete')).toBe(false);
  });

  it('does NOT have billing:manage', () => {
    expect(hasScope('member', 'billing:manage')).toBe(false);
  });
});

describe('viewer role', () => {
  it('has only read scopes (no write/manage/delete)', () => {
    const viewerScopes = getRoleScopes('viewer');
    const writeScopes = viewerScopes.filter((s) => !s.endsWith(':read'));
    // viewer may have non-:read scopes only if they are non-mutating
    // Assert it has no mutating actions
    const mutatingActions = [':write', ':delete', ':manage', ':create', ':execute', ':configure', ':invite', ':close', ':export'];
    for (const action of mutatingActions) {
      expect(viewerScopes.some((s) => s.endsWith(action))).toBe(false);
    }
    void writeScopes; // used above
  });

  it('has settings:read and billing:read', () => {
    expect(hasScope('viewer', 'settings:read')).toBe(true);
    expect(hasScope('viewer', 'billing:read')).toBe(true);
  });
});

describe('guest role', () => {
  it('has only minimal scopes', () => {
    const guestScopes = getRoleScopes('guest');
    expect(guestScopes.length).toBeLessThan(getRoleScopes('viewer').length);
  });

  it('does NOT have settings:read or billing:read', () => {
    expect(hasScope('guest', 'settings:read')).toBe(false);
    expect(hasScope('guest', 'billing:read')).toBe(false);
  });

  it('has project:read and design:read', () => {
    expect(hasScope('guest', 'project:read')).toBe(true);
    expect(hasScope('guest', 'design:read')).toBe(true);
  });
});

// ── Project role checks ───────────────────────────────────────────────────────

describe('project roles', () => {
  it('project:owner has project:delete and project:manage', () => {
    expect(hasScope('project:owner', 'project:delete')).toBe(true);
    expect(hasScope('project:owner', 'project:manage')).toBe(true);
  });

  it('project:editor has design:write but not project:manage', () => {
    expect(hasScope('project:editor', 'design:write')).toBe(true);
    expect(hasScope('project:editor', 'project:manage')).toBe(false);
  });

  it('project:reviewer can create and close issues but not write design', () => {
    expect(hasScope('project:reviewer', 'issue:create')).toBe(true);
    expect(hasScope('project:reviewer', 'issue:close')).toBe(true);
    expect(hasScope('project:reviewer', 'design:write')).toBe(false);
  });

  it('project:viewer has only read scopes within PROJECT_ROLE_SCOPES', () => {
    const viewerScopes = PROJECT_ROLE_SCOPES['project:viewer'];
    for (const s of viewerScopes) {
      expect(s.endsWith(':read')).toBe(true);
    }
  });
});

// ── hasScope / hasAllScopes / hasAnyScope ─────────────────────────────────────

describe('hasScope', () => {
  it('returns true when role has the scope', () => {
    expect(hasScope('admin', 'team:invite')).toBe(true);
  });

  it('returns false when role lacks the scope', () => {
    expect(hasScope('guest', 'audit:write')).toBe(false);
  });
});

describe('hasAllScopes', () => {
  it('returns true when role has all listed scopes', () => {
    const scopes: Scope[] = ['project:read', 'design:read'];
    expect(hasAllScopes('member', scopes)).toBe(true);
  });

  it('returns false when any scope is missing', () => {
    const scopes: Scope[] = ['project:read', 'billing:manage'];
    expect(hasAllScopes('member', scopes)).toBe(false);
  });

  it('returns true for an empty scopes array', () => {
    expect(hasAllScopes('guest', [])).toBe(true);
  });
});

describe('hasAnyScope', () => {
  it('returns true when at least one scope matches', () => {
    const scopes: Scope[] = ['billing:manage', 'project:read'];
    expect(hasAnyScope('member', scopes)).toBe(true); // member has project:read
  });

  it('returns false when no scope matches', () => {
    const scopes: Scope[] = ['billing:manage', 'team:manage'];
    expect(hasAnyScope('member', scopes)).toBe(false);
  });

  it('returns false for an empty scopes array', () => {
    expect(hasAnyScope('owner', [])).toBe(false);
  });
});

// ── combineScopes ─────────────────────────────────────────────────────────────

describe('combineScopes', () => {
  it('returns global scopes when no project role is provided', () => {
    const combined = combineScopes('viewer');
    expect(combined).toEqual(expect.arrayContaining(getRoleScopes('viewer')));
    expect(combined.length).toBe(getRoleScopes('viewer').length);
  });

  it('merges global + project scopes', () => {
    const combined = combineScopes('viewer', 'project:editor');
    expect(combined).toContain('design:write'); // from project:editor
    expect(combined).toContain('settings:read'); // from global viewer
  });

  it('deduplicates overlapping scopes', () => {
    const combined = combineScopes('member', 'project:editor');
    const uniqueCheck = new Set(combined);
    expect(uniqueCheck.size).toBe(combined.length);
  });

  it('guest + project:owner gains project management scopes', () => {
    const combined = combineScopes('guest', 'project:owner');
    expect(combined).toContain('project:manage');
    expect(combined).toContain('project:delete');
  });
});

// ── checkPermission ───────────────────────────────────────────────────────────

describe('checkPermission', () => {
  it('returns allowed:true when all required scopes are present', () => {
    const result = checkPermission('admin', ['project:read', 'team:manage']);
    expect(result.allowed).toBe(true);
    expect(result.missingScopes).toEqual([]);
    expect(result.role).toBe('admin');
  });

  it('returns allowed:false with missing scopes listed', () => {
    const required: Scope[] = ['billing:manage', 'project:read'];
    const result = checkPermission('member', required);
    expect(result.allowed).toBe(false);
    expect(result.missingScopes).toContain('billing:manage');
    expect(result.missingScopes).not.toContain('project:read');
  });

  it('returns all missing scopes when role has none of the required', () => {
    const required: Scope[] = ['billing:manage', 'team:manage'];
    const result = checkPermission('guest', required);
    expect(result.allowed).toBe(false);
    expect(result.missingScopes).toEqual(expect.arrayContaining(required));
  });

  it('works for project roles', () => {
    const result = checkPermission('project:editor', ['design:write', 'project:manage']);
    expect(result.allowed).toBe(false);
    expect(result.missingScopes).toContain('project:manage');
    expect(result.missingScopes).not.toContain('design:write');
  });
});

// ── getResourcePermissions ────────────────────────────────────────────────────

describe('getResourcePermissions', () => {
  it('returns correct booleans for project resource as admin', () => {
    const perms = getResourcePermissions('admin', 'project');
    expect(perms.read).toBe(true);
    expect(perms.write).toBe(true);
    expect(perms.delete).toBe(true);
    expect(perms.manage).toBe(true);
  });

  it('returns correct booleans for billing resource as member', () => {
    const perms = getResourcePermissions('member', 'billing');
    expect(perms.read).toBe(true);
    expect(perms.manage).toBe(false);
  });

  it('returns correct booleans for project resource as viewer', () => {
    const perms = getResourcePermissions('viewer', 'project');
    expect(perms.read).toBe(true);
    expect(perms.write).toBe(false);
    expect(perms.delete).toBe(false);
    expect(perms.manage).toBe(false);
  });

  it('always returns the standard CRUD keys', () => {
    const perms = getResourcePermissions('guest', 'team');
    expect('read' in perms).toBe(true);
    expect('write' in perms).toBe(true);
    expect('delete' in perms).toBe(true);
    expect('manage' in perms).toBe(true);
  });
});
