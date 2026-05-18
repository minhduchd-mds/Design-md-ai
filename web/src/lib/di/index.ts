/**
 * di/index.ts — Barrel file for the DI module.
 *
 * Public surface:
 *   Container        — the service container class
 *   TOKENS           — all registered service tokens (Symbols)
 *   bootstrapContainer — register all services; idempotent
 *   getContainer     — bootstrap-if-needed + return container
 *
 * Typical application usage:
 *
 *   import { getContainer, TOKENS } from '@/lib/di';
 *
 *   const stream = getContainer().get<AuditStream>(TOKENS.AuditStream);
 */

export { Container } from "./Container";
export { TOKENS } from "./tokens";
export type { ServiceToken } from "./tokens";
export { bootstrapContainer, getContainer } from "./bootstrap";
