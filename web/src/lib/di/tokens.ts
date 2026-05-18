/**
 * di/tokens.ts — Service token registry.
 *
 * Each token is a unique Symbol used as the key when registering and
 * resolving services from the DI container.  Using Symbols avoids any
 * risk of accidental string key collisions across modules.
 *
 * Convention: token name matches the class / interface name of the service.
 *
 * Usage:
 *   import { TOKENS } from './tokens';
 *   container.get<AuditRepository>(TOKENS.AuditRepository);
 */

export const TOKENS = {
  /** Repository for audit runs and checklist results (auditRepo.ts) */
  AuditRepository: Symbol("AuditRepository"),

  /** Repository for design context and project versioning (projectRepo.ts) */
  ProjectRepository: Symbol("ProjectRepository"),

  /** Repository for GitHub issues and pull requests (githubRepo.ts) */
  GitHubRepository: Symbol("GitHubRepository"),

  /** Repository for evidence artifacts and agent runs (evidenceRepo.ts) */
  EvidenceRepository: Symbol("EvidenceRepository"),

  /** Real-time audit streaming engine (ux-checklist/stream.ts) */
  AuditStream: Symbol("AuditStream"),

  /** Top-level orchestrator for the agentic UX audit pipeline (ux-checklist/index.ts) */
  UXOrchestrator: Symbol("UXOrchestrator"),
} as const;

/** Union of all registered token Symbols */
export type ServiceToken = (typeof TOKENS)[keyof typeof TOKENS];
