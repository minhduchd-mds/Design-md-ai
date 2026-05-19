/**
 * POST /api/agents/run — Execute Agent Fleet v6 operations.
 *
 * Accepts a fleet name + optional agent ID and input payload.
 * Routes to OrchestratorAgentV6 for multi-fleet scheduling,
 * or runs a single agent when agentId is specified.
 *
 * Body:
 *   { fleet?: FleetName, agentId?: string, input: unknown, budget?: number }
 *
 * Response:
 *   { ok: true, result: AgentResultV6, costUsd: number }
 *   { ok: false, error: string }
 */

import {
  buildCorsHeaders,
  errorResponse,
  handlePreflight,
} from "../lib/chat-shared";
import { checkRateLimit, getClientIp } from "../lib/rateLimit";

export const config = { runtime: "edge", maxDuration: 60 };

// ── Types (kept inline to avoid importing from web/ in edge runtime) ──

type FleetName =
  | "audit"
  | "command"
  | "fix"
  | "map"
  | "safety"
  | "self-improve"
  | "verify";

interface AgentRunRequest {
  fleet?: FleetName;
  agentId?: string;
  input?: unknown;
  budget?: number;
  /** When true, return agent registry instead of running */
  listAgents?: boolean;
}

// ── Agent Registry (static metadata for the 22 agents) ──────────────

const AGENT_REGISTRY: Array<{
  id: string;
  name: string;
  fleet: FleetName;
  role: string;
  description: string;
}> = [
  // Command fleet
  { id: "command.human-command", name: "HumanCommandAgent", fleet: "command", role: "analyzer", description: "Natural language command parser (12 patterns)" },
  { id: "command.issue-to-task", name: "IssueToTaskAgent", fleet: "command", role: "analyzer", description: "GitHub/Figma/diagnostic issue → actionable task" },
  // Map fleet
  { id: "map.repo-map", name: "RepoMapAgent", fleet: "map", role: "analyzer", description: "Repository structure indexing" },
  { id: "map.component-trace", name: "ComponentTraceAgent", fleet: "map", role: "analyzer", description: "Figma-to-code component mapping" },
  { id: "map.design-context", name: "DesignContextAgent", fleet: "map", role: "analyzer", description: "Design system bridge" },
  // Audit fleet
  { id: "audit.architecture-drift", name: "ArchitectureDriftAgent", fleet: "audit", role: "analyzer", description: "Circular deps, naming rules, barrel gaps, layer breaches, orphans" },
  // Self-improve fleet
  { id: "self-improve.self-diagnostic", name: "SelfDiagnosticAgent", fleet: "self-improve", role: "analyzer", description: "Codebase health scanner" },
  { id: "self-improve.refactor", name: "RefactorAgent", fleet: "self-improve", role: "generator", description: "any→unknown, dead disables" },
  { id: "self-improve.test-gen", name: "TestGenAgent", fleet: "self-improve", role: "generator", description: "Auto-generate test stubs" },
  { id: "self-improve.dep-audit", name: "DependencyAuditAgent", fleet: "self-improve", role: "analyzer", description: "Dependency security audit" },
  { id: "self-improve.self-audit", name: "SelfAuditAgent", fleet: "self-improve", role: "validator", description: "Agent fleet self-audit" },
  { id: "self-improve.benchmark", name: "BenchmarkAgent", fleet: "self-improve", role: "analyzer", description: "Performance benchmarking" },
  // Fix fleet
  { id: "fix.code-fix", name: "CodeFixAgent", fleet: "fix", role: "generator", description: "Unified diff generation" },
  { id: "fix.diff-applier", name: "DiffApplierAgent", fleet: "fix", role: "generator", description: "Worktree-only diff application" },
  { id: "fix.rollback", name: "RollbackAgent", fleet: "fix", role: "generator", description: "Git reset+clean rollback" },
  // Safety fleet
  { id: "safety.safety-gate", name: "SafetyGateAgent", fleet: "safety", role: "validator", description: "7 secret patterns, protected files, max-files policy" },
  { id: "safety.regression-guard", name: "RegressionGuardAgent", fleet: "safety", role: "validator", description: "Lint/build/test fail-fast gate (120s timeout)" },
  { id: "safety.conflict-resolver", name: "ConflictResolverAgent", fleet: "safety", role: "validator", description: "Same-region/adjacent/whole-file detection" },
  // Verify fleet
  { id: "verify.test-runner", name: "TestRunnerAgent", fleet: "verify", role: "validator", description: "Vitest runner" },
  { id: "verify.lint-runner", name: "LintRunnerAgent", fleet: "verify", role: "validator", description: "ESLint runner" },
  { id: "verify.build-verifier", name: "BuildVerifierAgent", fleet: "verify", role: "validator", description: "tsc+build verification" },
  // Orchestrator (virtual)
  { id: "orchestrator", name: "OrchestratorAgentV6", fleet: "command", role: "orchestrator", description: "Multi-fleet scheduler with cost gate" },
];

const VALID_FLEETS = new Set<string>(["audit", "command", "fix", "map", "safety", "self-improve", "verify"]);

// ── Handler ──────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const cors = buildCorsHeaders(req);

  // Rate limiting — uses shared sliding-window limiter (20 req/60s per IP)
  const ip = getClientIp(Object.fromEntries(req.headers.entries()));
  const rl = checkRateLimit(`agents:${ip}`);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ ok: false, error: "Too many agent requests. Try again later." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(Math.ceil(rl.resetMs / 1000)) },
    });
  }

  let body: AgentRunRequest;
  try {
    body = (await req.json()) as AgentRunRequest;
  } catch {
    return errorResponse("Invalid JSON.", 400, req);
  }

  // ── List agents endpoint ──────────────────────────────────────────
  if (body.listAgents) {
    return new Response(JSON.stringify({
      ok: true,
      agents: AGENT_REGISTRY,
      fleets: [...VALID_FLEETS],
    }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ── Validate request ──────────────────────────────────────────────
  if (!body.agentId && !body.fleet) {
    return errorResponse("Provide agentId or fleet.", 400, req);
  }

  if (body.fleet && !VALID_FLEETS.has(body.fleet)) {
    return errorResponse(`Invalid fleet: ${body.fleet}. Valid: ${[...VALID_FLEETS].join(", ")}`, 400, req);
  }

  if (body.agentId && !AGENT_REGISTRY.some((a) => a.id === body.agentId)) {
    return errorResponse(`Unknown agent: ${body.agentId}. Use listAgents=true to see available agents.`, 400, req);
  }

  // ── Stub response (agents run client-side in v6; this endpoint ──
  // ── provides the orchestration entry point for future server-side ──
  // ── execution when LLM integration lands in Tier 2) ───────────────

  const agent = body.agentId
    ? AGENT_REGISTRY.find((a) => a.id === body.agentId)
    : null;

  const fleetAgents = body.fleet
    ? AGENT_REGISTRY.filter((a) => a.fleet === body.fleet)
    : agent
      ? [agent]
      : [];

  return new Response(JSON.stringify({
    ok: true,
    status: "queued",
    runId: crypto.randomUUID(),
    fleet: body.fleet ?? agent?.fleet,
    agents: fleetAgents.map((a) => a.id),
    budget: body.budget ?? 1.0,
    message: "Agent run queued. Server-side execution will be available when LLM integration lands (Tier 2). Currently agents run client-side via OrchestratorAgentV6.",
  }), {
    status: 202,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
