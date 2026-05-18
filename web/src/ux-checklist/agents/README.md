# UX Checklist — Agent System

Specialized agentic auditors (v4) that decompose the generic audit process into focused, composable units aligned with Shannon Engine's `AgentConfig` pattern.

## Overview

Each agent is a pure class that extends `BaseAgent`. Agents receive structured Figma scan data and audit criteria via `AgentContext`, then return a typed `AgentExecutionResult` envelope containing the output, confidence score, token usage, and evidence references.

The pipeline is orchestrated by the Shannon Engine. Agents register themselves via `getAgentConfigs()` and execute independently or in parallel.

---

## Agents

| Agent | File | Role | Responsibilities |
|---|---|---|---|
| `DesignAuditAgent` | `DesignAuditAgent.ts` | `analyzer` | Scores UI/UX against checklist criteria: layout, interaction patterns, visual hierarchy, component states |
| `AccessibilityAgent` | `AccessibilityAgent.ts` | `validator` | WCAG compliance: contrast 4.5:1, touch targets 24px, ARIA labels, keyboard navigation, focus indicators, heading hierarchy |
| `DesignSystemAgent` | `DesignSystemAgent.ts` | `analyzer` | Design system compliance: token coverage (color/typography/elevation), spacing grid (4px), component naming |
| `FixPlannerAgent` | `FixPlannerAgent.ts` | `optimizer` | Generates prioritized fix plans from failed audit results with effort estimates and risk levels |
| `IssueWriterAgent` | `IssueWriterAgent.ts` | `generator` | Produces structured GitHub issue payloads with labels, priority, acceptance criteria, and evidence |

---

## Types

All shared interfaces live in `types.ts`:

- `AgentRole` — Role classification: `analyzer | generator | validator | optimizer | orchestrator`
- `AgentConfig` — Shannon Engine registration metadata
- `AgentContext` — Shared execution context (project name, criteria, previous results)
- `AgentExecutionResult` — Standardized result envelope
- `BaseAgent` — Abstract base class with timing and error handling
- `FixPlan` / `FixPlanStep` — Fix plan structures
- `GitHubIssuePayload` — GitHub issue structure

---

## Agent Pipeline Flow

```
Figma Scan Data
      │
      ▼
┌─────────────────────────────────────────┐
│           Shannon Engine                │
│         (orchestrator)                  │
└────┬──────────────┬──────────────┬──────┘
     │              │              │
     ▼              ▼              ▼
DesignAudit   Accessibility  DesignSystem
  Agent          Agent          Agent
(analyzer)    (validator)    (analyzer)
     │              │              │
     └──────────────┴──────────────┘
                    │
              AuditResult[]
           (failed + warned)
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
    FixPlanner          IssueWriter
      Agent               Agent
   (optimizer)          (generator)
          │                   │
          ▼                   ▼
       FixPlan[]       GitHubIssuePayload[]
```

---

## Creating a New Agent

1. Create a file `MyNewAgent.ts` in this directory.
2. Import and extend `BaseAgent` from `./types`.
3. Implement all abstract members: `id`, `role`, `capabilities`, `description`, and `run()`.
4. Export the class.
5. Register it in `index.ts`:
   - Add an `export { MyNewAgent } from './MyNewAgent'`
   - Add an instance to `SPECIALIZED_AGENTS`

```typescript
// MyNewAgent.ts
import { BaseAgent } from "./types";
import type { AgentRole, AgentContext } from "./types";

export class MyNewAgent extends BaseAgent {
  readonly id = "my-new-agent";
  readonly role: AgentRole = "analyzer";
  readonly capabilities = ["my-capability"];
  readonly description = "Does something specific.";

  protected async run(input: unknown, context: AgentContext) {
    // Your logic here
    return {
      output: {},
      confidence: 0.8,
      tokensUsed: 10,
      evidenceRefs: [],
    };
  }
}
```

```typescript
// index.ts — add to SPECIALIZED_AGENTS
import { MyNewAgent } from "./MyNewAgent";

export const SPECIALIZED_AGENTS = {
  // ...existing agents...
  myNew: new MyNewAgent(),
} as const;
```

---

## Usage

```typescript
import { SPECIALIZED_AGENTS, getAgentConfigs, executeAgent } from "./agents";

// Register all agents with the Shannon Engine
const configs = getAgentConfigs();

// Execute a specific agent
const result = await executeAgent("accessibility-agent", nodeData, {
  projectName: "my-app",
  criteria,
});

// Or use agent instances directly
const agent = SPECIALIZED_AGENTS.accessibility;
const result = await agent.execute(nodeData, context);
```
