/**
 * IssueToTaskAgent — converts issues from any source into structured tasks.
 *
 * Sources: GitHub issue, Figma audit issue, SelfDiagnostic candidate,
 * chat message, or design scan result.
 *
 * Output: a normalized AgentTask that can be routed to the OrchestratorAgent.
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IssueSource = "github" | "figma-audit" | "self-diagnostic" | "chat" | "design-scan";

export interface RawIssue {
  /** Source of the issue */
  source: IssueSource;
  /** Title or summary */
  title: string;
  /** Full description */
  body?: string;
  /** Severity from source */
  severity?: "critical" | "high" | "medium" | "low";
  /** File path if known */
  file?: string;
  /** Line number if known */
  line?: number;
  /** Component name if relevant */
  componentName?: string;
  /** Figma node ID if from design */
  figmaNodeId?: string;
  /** Labels / tags */
  labels?: string[];
}

export interface IssueToTaskInput {
  /** Raw issues to convert */
  issues: RawIssue[];
}

export type TaskPriority = "p0-critical" | "p1-high" | "p2-medium" | "p3-low";
export type TaskAction = "fix-code" | "add-test" | "refactor" | "audit" | "trace" | "investigate";

export interface AgentTask {
  /** Unique task ID */
  id: string;
  /** Normalized title */
  title: string;
  /** Priority based on severity + source */
  priority: TaskPriority;
  /** Recommended action */
  action: TaskAction;
  /** Target fleets */
  fleets: FleetName[];
  /** Scope: file paths or component names */
  scope: string[];
  /** Source issue reference */
  sourceRef: { source: IssueSource; title: string };
  /** Rationale for priority/action assignment */
  rationale: string;
}

export interface IssueToTaskOutput {
  /** Normalized tasks ready for orchestration */
  tasks: AgentTask[];
  /** Issues that could not be parsed into tasks */
  skipped: { title: string; reason: string }[];
  /** Stats */
  stats: {
    total: number;
    byPriority: Record<TaskPriority, number>;
    byAction: Record<TaskAction, number>;
  };
}

export class IssueToTaskAgent extends BaseAgentV6<IssueToTaskInput, IssueToTaskOutput> {
  readonly id = "command.issue-to-task";
  readonly name = "Issue to Task";
  readonly fleet: FleetName = "command";
  readonly role = "analyzer" as const;
  readonly description = "Converts raw issues from any source into structured agent tasks";

  protected async run(
    input: IssueToTaskInput,
    ctx: AgentContextV6,
  ): Promise<{ output: IssueToTaskOutput }> {
    const tasks: AgentTask[] = [];
    const skipped: IssueToTaskOutput["skipped"] = [];
    let taskIndex = 0;

    for (const issue of input.issues) {
      if (!issue.title || issue.title.trim().length === 0) {
        skipped.push({ title: "(empty)", reason: "Empty title" });
        continue;
      }

      const priority = mapPriority(issue);
      const action = inferAction(issue);
      const fleets = inferFleets(action);
      const scope = buildScope(issue);

      tasks.push({
        id: `task-${ctx.runId}-${taskIndex++}`,
        title: normalizeTitle(issue.title),
        priority,
        action,
        fleets,
        scope,
        sourceRef: { source: issue.source, title: issue.title },
        rationale: buildRationale(issue, priority, action),
      });
    }

    // Sort by priority
    const priorityOrder: Record<TaskPriority, number> = {
      "p0-critical": 0,
      "p1-high": 1,
      "p2-medium": 2,
      "p3-low": 3,
    };
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const stats = {
      total: tasks.length,
      byPriority: countBy(tasks, "priority") as Record<TaskPriority, number>,
      byAction: countBy(tasks, "action") as Record<TaskAction, number>,
    };

    ctx.logger.info(
      `[issue-to-task] converted ${tasks.length}/${input.issues.length} issues, skipped ${skipped.length}`,
    );

    return {
      output: { tasks, skipped, stats },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapPriority(issue: RawIssue): TaskPriority {
  if (issue.severity === "critical") return "p0-critical";
  if (issue.severity === "high") return "p1-high";
  if (issue.severity === "medium") return "p2-medium";
  if (issue.severity === "low") return "p3-low";

  // Infer from source
  if (issue.source === "self-diagnostic") return "p2-medium";
  if (issue.source === "figma-audit") return "p2-medium";
  if (issue.source === "github") {
    if (issue.labels?.includes("bug")) return "p1-high";
    if (issue.labels?.includes("enhancement")) return "p2-medium";
  }
  return "p3-low";
}

function inferAction(issue: RawIssue): TaskAction {
  const text = `${issue.title} ${issue.body ?? ""}`.toLowerCase();

  if (text.includes("test") || text.includes("coverage") || text.includes("spec")) return "add-test";
  if (text.includes("refactor") || text.includes("any") || text.includes("eslint-disable")) return "refactor";
  if (text.includes("trace") || text.includes("component") || text.includes("figma")) return "trace";
  if (text.includes("audit") || text.includes("review") || text.includes("check")) return "audit";
  if (issue.file || text.includes("fix") || text.includes("bug") || text.includes("error")) return "fix-code";
  return "investigate";
}

function inferFleets(action: TaskAction): FleetName[] {
  switch (action) {
    case "fix-code": return ["self-improve", "fix", "safety", "verify"];
    case "add-test": return ["self-improve", "verify"];
    case "refactor": return ["self-improve", "fix", "safety"];
    case "audit": return ["audit", "verify"];
    case "trace": return ["map"];
    case "investigate": return ["map", "audit"];
  }
}

function buildScope(issue: RawIssue): string[] {
  const scope: string[] = [];
  if (issue.file) scope.push(issue.file);
  if (issue.componentName) scope.push(issue.componentName);
  if (scope.length === 0) scope.push(".");
  return scope;
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").slice(0, 200);
}

function buildRationale(issue: RawIssue, priority: TaskPriority, action: TaskAction): string {
  return `Source: ${issue.source}, severity: ${issue.severity ?? "unset"} → priority: ${priority}, action: ${action}`;
}

function countBy<T extends Record<string, unknown>>(items: T[], key: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const val = String(item[key]);
    counts[val] = (counts[val] ?? 0) + 1;
  }
  return counts;
}
