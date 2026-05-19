# ADR-001: Agent Fleet v6 — Autonomous Self-Improving Agent System

**Status:** Implemented
**Date:** 2026-05-19
**Authors:** Desygn AI team
**Influences:** [Stably AI Orca](https://github.com/stablyai/orca), n8n DI patterns, current v5 agentic auditor

---

## Context

Desygn AI v5 ships 8 specialized AI agents for UI/UX audit (`DesignAuditAgent`, `AccessibilityAgent`, `DesignSystemAgent`, `ScoreAgent`, `RecommendAgent`, `FixPlannerAgent`, `IssueWriterAgent`, `MemoryAgent`). They run as a sequential pipeline orchestrated by `shannonEngine.ts` with limited `Promise.all` batching.

**Limitations:**
1. Agents propose fixes (`FixPlannerAgent`) but never apply them — every fix is human-applied.
2. The system audits *designs* but cannot audit its own *codebase*.
3. Failed audits don't trigger learning beyond evidence memory weight adjustments.
4. No isolation between concurrent agent runs — they share process state.
5. Verification (test/lint/build) is external CI, not an integrated agent.

## Decision

We built **Agent Fleet v6** — an eight-fleet, 22-agent system that combines:
- Orca's worktree isolation + parallel execution
- Desygn AI's evidence-based learning
- A self-improvement loop that audits and improves Desygn AI's own codebase
- Command/map/safety layers for autonomous pipeline orchestration

The user remains the **conductor**: every code change requires explicit approval through the FixApprovalUI diff preview component.

## Architecture

```
                       ┌──────────────────────────────┐
                       │   USER (Conductor)            │
                       │  • Natural language commands   │
                       │  • Approve/reject diffs        │
                       │  • Override agent decisions    │
                       └─────────┬────────────────────┘
                                 │
                       ┌─────────▼────────────────────┐
                       │   HumanCommandAgent           │
                       │  • Parse NL → Mission          │
                       │  • Route to fleets             │
                       └─────────┬────────────────────┘
                                 │
                       ┌─────────▼────────────────────┐
                       │   OrchestratorAgent v6        │
                       │  • Promise.allSettled parallel │
                       │  • Cost gate ($MAX_COST_USD)   │
                       │  • Fleet scheduling            │
                       └─────────┬────────────────────┘
                                 │ fan-out
     ┌──────────┬────────┬───────┴───────┬────────┬──────────┬──────────┐
     ▼          ▼        ▼               ▼        ▼          ▼          ▼
┌─────────┐ ┌──────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────┐
│ Audit   │ │Cmd   │ │   Map    │ │SelfImprov│ │  Fix   │ │ Safety │ │Verify│
│ (1 agt) │ │(2)   │ │  (3 agt) │ │  (6 agt) │ │ (3+UI) │ │ (3 agt)│ │(3)   │
└────┬────┘ └──┬───┘ └────┬─────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └──┬───┘
     └─────────┴──────────┴────────────┴────────────┴──────────┴─────────┘
                                 │
                       ┌─────────▼────────────────────┐
                       │   Shared Infrastructure       │
                       │  • BaseAgentV6 (abstract)      │
                       │  • WorktreeRunner (isolation)  │
                       │  • EvidenceMemory (HNSW v3)   │
                       │  • EventBus (60fps stream)    │
                       │  • Supabase agent_runs table  │
                       └──────────────────────────────┘
```

## Implementation Status

| Component | Status | Tests | LOC |
|-----------|--------|-------|-----|
| BaseAgentV6 | ✅ Implemented | 6 | 120 |
| OrchestratorAgentV6 | ✅ Implemented | 11 | 160 |
| WorktreeRunner | ✅ Implemented | via E2E | 270 |
| 22 Agent modules | ✅ All implemented | 192 total | 4,565 |
| FixApprovalUI | ✅ Implemented | 10 + 5 stories | 620 |
| Supabase migration 004 | ✅ Created | — | 60 |
| **Total** | **102 test files** | **1,529 tests** | **7,200+** |

## Fleets

### Fleet 1: Audit (1 agent — NEW v6)

| Agent | Role | Purpose | Tests |
|---|---|---|---|
| `ArchitectureDriftAgent` | analyzer | Circular deps, naming rules, barrel gaps, layer breaches, orphan detection | 12 |

### Fleet 2: Command (2 agents — NEW)

| Agent | Role | Purpose | Tests |
|---|---|---|---|
| `HumanCommandAgent` | analyzer | Parses NL commands into Mission objects (12 patterns) | 10 |
| `IssueToTaskAgent` | analyzer | Converts GitHub/Figma/diagnostic issues into prioritized AgentTasks | 7 |

### Fleet 3: Map (3 agents — NEW)

| Agent | Role | Purpose | Tests |
|---|---|---|---|
| `RepoMapAgent` | analyzer | Indexes repo structure, exports, imports, tokens, deps | 9 |
| `ComponentTraceAgent` | analyzer | Maps Figma component names to code files (exact/fuzzy/kebab) | 7 |
| `DesignContextAgent` | analyzer | Bridges Figma scan data into agent-consumable context | 11 |

### Fleet 4: Self-Improvement (6 agents)

| Agent | Role | Purpose | Tests |
|---|---|---|---|
| `SelfDiagnosticAgent` | analyzer | Static scan: `: any`, TODO/FIXME, large files, nesting depth | 9 |
| `RefactorAgent` | optimizer | Deterministic refactors: any→unknown, long-fn split, unused imports | 5 |
| `TestGenAgent` | generator | Template-based test scaffolding (v0 deterministic, v1 LLM) | 5 |
| `DependencyAuditAgent` | analyzer | `npm audit` + `npm outdated` JSON parsing | 7 |
| `SelfAuditAgent` | analyzer | Agent fleet health grading (A-F), recurring failures, recommendations | 8 |
| `BenchmarkAgent` | analyzer | Before/after metric comparison with weighted improvement score | 9 |

### Fleet 5: Fix Application (3 agents + UI)

| Agent | Role | Purpose | Tests |
|---|---|---|---|
| `CodeFixAgent` | generator | Generates unified diffs from diagnostic findings | 5 |
| `DiffApplierAgent` | validator | Applies diffs in worktree only (never touches main) | 5 |
| `RollbackAgent` | validator | `git reset --hard` + `git clean -fd` in worktree | 6 |
| `useFixApproval` | hook | Pure reducer for proposal approval state | 10 |
| `FixApprovalUI` | component | Dark-theme diff viewer with approve/reject/bulk actions | 5 stories |

### Fleet 6: Safety (3 agents — NEW)

| Agent | Role | Purpose | Tests |
|---|---|---|---|
| `SafetyGateAgent` | validator | Policy engine: secrets, protected files, max-files, risk levels | 8 |
| `RegressionGuardAgent` | validator | Lint→build→test gate with fail-fast and 120s timeout | 7 |
| `ConflictResolverAgent` | analyzer | Detects/resolves merge conflicts between parallel agent patches | 11 |

### Fleet 7: Verification (3 agents)

CLI tools wrapped as agents implementing `BaseAgentV6`:

| Agent | Wraps | Role | Tests |
|---|---|---|---|
| `TestRunnerAgent` | `npx vitest run` | validator | 8 |
| `LintRunnerAgent` | `npx eslint .` | validator | 7 |
| `BuildVerifierAgent` | `npx tsc --noEmit && npm run build` | validator | 7 |

## Self-Improvement Loop

```
1. Trigger: HumanCommandAgent parses "fix any types" or scheduled cron
2. IssueToTaskAgent converts issues → prioritized tasks
3. SelfDiagnosticAgent.execute()
   → Returns: ImprovementCandidate[] with cost/impact estimates
4. OrchestratorAgent.plan()
   → Cost-gate filters, returns prioritized queue
5. For each candidate (parallel up to MAX_CONCURRENT):
   5a. WorktreeRunner.create(`improve-{candidate.id}`)
   5b. Spawn relevant generator agent (RefactorAgent, TestGenAgent, etc.)
   5c. CodeFixAgent generates diff
   5d. SafetyGateAgent validates (no secrets, protected files)
   5e. DiffApplierAgent applies in worktree
   5f. RegressionGuardAgent runs lint→build→test (fail-fast)
   5g. If all pass → mark "approval-pending"
       If any fail → RollbackAgent + log evidence
6. ConflictResolverAgent resolves overlapping patches
7. FixApprovalUI shows pending approvals to user
8. User clicks Approve → merge worktree to main via PR
   User clicks Reject → log as "negative example"
9. SelfAuditAgent tracks fleet health, BenchmarkAgent measures improvement
```

## Safety Guards

| Guard | Implementation | Agent |
|---|---|---|
| **Cost gate** | `OrchestratorAgent.totalCostUsd` ≤ `MAX_COST_USD` | BaseAgentV6 |
| **Worktree TTL** | Cleanup >24h old worktrees | WorktreeRunner |
| **Secret detection** | 6 regex patterns (API keys, AWS, GitHub, OpenAI, JWT, private keys) | SafetyGateAgent |
| **Protected files** | Block `.env*`, `*.pem`, `credentials*`, CI workflows, Dockerfile, lock files | SafetyGateAgent |
| **Max files per patch** | Default 10, configurable | SafetyGateAgent |
| **Conflict resolution** | Same-region/adjacent/whole-file detection, auto + manual modes | ConflictResolverAgent |
| **Circular dep detection** | DFS graph coloring on import graph | ArchitectureDriftAgent |
| **Regression guard** | Lint→build→test fail-fast gate (120s timeout per step) | RegressionGuardAgent |
| **User approval gate** | FixApprovalUI: approve/reject/bulk/undo per proposal | useFixApproval |
| **Branch protection** | `main` is read-only for agents; all writes go through worktree | DiffApplierAgent |

## File Structure

```
web/src/lib/agents/v6/
├── BaseAgent.ts              # Abstract base, FleetName, AgentContextV6
├── OrchestratorAgent.ts      # Multi-fleet scheduler
├── WorktreeRunner.ts         # Git worktree isolation
├── index.ts                  # Main barrel
├── audit/
│   ├── ArchitectureDriftAgent.ts
│   └── index.ts
├── command/
│   ├── HumanCommandAgent.ts
│   ├── IssueToTaskAgent.ts
│   └── index.ts
├── fix/
│   ├── CodeFixAgent.ts
│   ├── DiffApplierAgent.ts
│   ├── RollbackAgent.ts
│   ├── useFixApproval.ts
│   └── index.ts
├── map/
│   ├── RepoMapAgent.ts
│   ├── ComponentTraceAgent.ts
│   ├── DesignContextAgent.ts
│   └── index.ts
├── safety/
│   ├── SafetyGateAgent.ts
│   ├── RegressionGuardAgent.ts
│   ├── ConflictResolverAgent.ts
│   └── index.ts
├── self-improve/
│   ├── SelfDiagnosticAgent.ts
│   ├── RefactorAgent.ts
│   ├── TestGenAgent.ts
│   ├── DependencyAuditAgent.ts
│   ├── SelfAuditAgent.ts
│   ├── BenchmarkAgent.ts
│   └── index.ts
├── verify/
│   ├── TestRunnerAgent.ts
│   ├── LintRunnerAgent.ts
│   ├── BuildVerifierAgent.ts
│   └── index.ts
└── __tests__/                # 25 test files, 192 tests
    ├── BaseAgent.test.ts
    ├── OrchestratorAgent.test.ts
    ├── e2e-self-improve.test.ts
    ├── useFixApproval.test.ts
    ├── ArchitectureDriftAgent.test.ts
    ├── BenchmarkAgent.test.ts
    ├── BuildVerifierAgent.test.ts
    ├── CodeFixAgent.test.ts
    ├── ComponentTraceAgent.test.ts
    ├── ConflictResolverAgent.test.ts
    ├── DependencyAuditAgent.test.ts
    ├── DesignContextAgent.test.ts
    ├── DiffApplierAgent.test.ts
    ├── HumanCommandAgent.test.ts
    ├── IssueToTaskAgent.test.ts
    ├── LintRunnerAgent.test.ts
    ├── RepoMapAgent.test.ts
    ├── RefactorAgent.test.ts
    ├── RegressionGuardAgent.test.ts
    ├── RollbackAgent.test.ts
    ├── SafetyGateAgent.test.ts
    ├── SelfAuditAgent.test.ts
    ├── SelfDiagnosticAgent.test.ts
    ├── TestGenAgent.test.ts
    └── TestRunnerAgent.test.ts
```

## Database

**Migration:** `supabase/migrations/004_agent_runs.sql`

```sql
-- agent_runs table: stores every agent execution
-- Columns: id, run_id, project_id, agent_id, fleet, success, cost_usd,
--          latency_ms, error, input_summary, output_summary, evidence (JSONB),
--          files_modified, created_at
-- RLS: user access via project_id, service role insert
-- VIEW: agent_health_summary (aggregated metrics per agent)
```

## Roadmap

### Completed (Sprint 1-4)
- [x] BaseAgentV6 + OrchestratorAgentV6 + WorktreeRunner
- [x] Verification Fleet (3 agents)
- [x] Self-Improvement Fleet (6 agents)
- [x] Fix Application Fleet (3 agents + UI)
- [x] Command Fleet (2 agents)
- [x] Map Fleet (3 agents)
- [x] Safety Fleet (3 agents)
- [x] Audit Fleet (1 agent)
- [x] 100% test coverage (25 test files, 192 agent tests)
- [x] Supabase migration for agent_runs

### Next (E-series)
- [ ] E1: Wiring layer (Figma plugin ↔ agents, Web UI hooks, API route)
- [ ] E2: LLM v1 integration (RefactorAgent, TestGenAgent, CodeFixAgent via ChatEngine)
- [ ] E3: Agent health dashboard UI
- [ ] E4: Persistent queue + agent registry
- [ ] E5: Supabase repository layer for run persistence

## References

- [Stably AI Orca](https://github.com/stablyai/orca) — worktree-native multi-agent IDE
- [n8n DI Container](https://github.com/n8n-io/n8n) — symbol-token dependency injection
- Desygn AI v5 docs: `docs/DEV_GUIDE.md`
- Evidence Memory v3: `web/src/lib/evidenceMemory.ts`
