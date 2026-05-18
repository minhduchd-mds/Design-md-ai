/**
 * di/bootstrap.ts — Wire up all application services into the DI container.
 *
 * `bootstrapContainer()` registers every service exactly once.
 * All registrations use factories (lazy) so heavy classes are not instantiated
 * until the first consumer calls `container.get(token)`.
 *
 * `getContainer()` is the recommended entry-point for application code:
 * it bootstraps if not yet done and returns the ready-to-use container.
 *
 * Usage:
 *   import { getContainer } from '@/lib/di';
 *   import { TOKENS }       from '@/lib/di';
 *
 *   const repo = getContainer().get<AuditRepository>(TOKENS.AuditRepository);
 */

import { Container } from "./Container";
import { TOKENS } from "./tokens";

// ── Service imports ───────────────────────────────────────────────────────────

import {
  AuditRepository,
  ProjectRepository,
  GitHubRepository,
  EvidenceRepository,
} from "../repos";

import { AuditStream } from "../../ux-checklist/stream";
import { UXChecklistOrchestrator } from "../../ux-checklist/index";

// ── Bootstrap state ───────────────────────────────────────────────────────────

let _bootstrapped = false;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register all application services into the singleton container.
 *
 * Idempotent: calling it more than once is a no-op (guards with a flag).
 * Call `container.reset()` followed by re-invoking `bootstrapContainer()`
 * if you need to re-register (e.g. in integration tests).
 */
export function bootstrapContainer(): Container {
  const container = Container.getInstance();

  if (_bootstrapped) {
    return container;
  }

  // ── Repositories ────────────────────────────────────────────────────────────
  container.register(TOKENS.AuditRepository, () => new AuditRepository());
  container.register(TOKENS.ProjectRepository, () => new ProjectRepository());
  container.register(TOKENS.GitHubRepository, () => new GitHubRepository());
  container.register(TOKENS.EvidenceRepository, () => new EvidenceRepository());

  // ── Streaming engine ─────────────────────────────────────────────────────────
  container.register(TOKENS.AuditStream, () => new AuditStream());

  // ── Orchestrator ─────────────────────────────────────────────────────────────
  container.register(TOKENS.UXOrchestrator, () => new UXChecklistOrchestrator());

  _bootstrapped = true;
  return container;
}

/**
 * Shorthand: bootstrap (if not yet done) and return the container.
 *
 * This is the function most application code should use:
 *
 * @example
 * const auditor = getContainer().get<UXChecklistOrchestrator>(TOKENS.UXOrchestrator);
 */
export function getContainer(): Container {
  return bootstrapContainer();
}

/**
 * Reset the bootstrap flag so `bootstrapContainer()` will re-register all
 * services on the next call.  Intended for test teardown only.
 *
 * @internal
 */
export function _resetBootstrap(): void {
  _bootstrapped = false;
}
