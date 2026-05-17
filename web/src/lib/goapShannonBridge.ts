/**
 * GOAP ↔ Shannon Engine Bridge v3
 *
 * Connects autonomous GOAP planning with 10-agent Shannon orchestration.
 * GOAP decides WHAT to do → Shannon decides HOW to do it.
 *
 * Architecture:
 *   GOAPPlanner → WorldState assessment → Plan generation
 *       ↓
 *   ShannonEngine10 → Task creation from plan steps → Agent execution
 *       ↓
 *   EvidenceMemory → Store results as validated evidence
 *
 * Key innovation: Agents can re-plan mid-execution if world state changes.
 */

import { GOAPPlanner, type GOAPGoal, type Plan, type WorldState, type GOAPAction } from "./goapPlanner";
import { ShannonEngine10, type AgentTask, type AgentType } from "./shannonEngine10Agents";
import { EvidenceMemoryEngine, type EvidenceSource } from "./evidenceMemory";

// ── Types ─────────────────────────────────────────────────────

export interface BridgeConfig {
  enableReplanning?: boolean;     // default true — re-plan if step fails
  enableEvidenceStorage?: boolean; // default true — store results in memory
  maxReplanAttempts?: number;     // default 3
  planningTimeoutMs?: number;     // default 5000
}

export interface ExecutionResult {
  plan: Plan;
  agentResults: AgentStepResult[];
  replanned: boolean;
  replanCount: number;
  totalLatencyMs: number;
  evidenceIds: string[];
  worldStateAfter: WorldState;
}

export interface AgentStepResult {
  stepIndex: number;
  actionName: string;
  agentType: AgentType;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  latencyMs: number;
}

// ── Action → Agent Mapping ───────────────────────────────────

const ACTION_AGENT_MAP: Record<string, AgentType> = {
  "analyze-component": "design-analyzer",
  "extract-tokens": "design-analyzer",
  "generate-code": "code-generator",
  "validate-output": "security-validator",
  "store-evidence": "design-system-learner",
  "detect-patterns": "design-system-learner",
  "resolve-contradictions": "design-system-learner",
  "check-accessibility": "accessibility-validator",
  "optimize-mobile": "mobile-optimizer",
  "optimize-performance": "performance-optimizer",
  "generate-docs": "documentation-agent",
  "generate-tests": "test-generator",
  "deploy": "deployment-orchestrator",
};

// ── Bridge ───────────────────────────────────────────────────

export class GOAPShannonBridge {
  private planner: GOAPPlanner;
  private shannonEngine: ShannonEngine10;
  private evidenceEngine: EvidenceMemoryEngine | null;
  private config: Required<BridgeConfig>;
  private worldState: WorldState = new Map();
  private stats = {
    totalExecutions: 0,
    successfulPlans: 0,
    failedPlans: 0,
    totalReplans: 0,
    totalSteps: 0,
    totalEvidenceStored: 0,
  };

  constructor(config?: BridgeConfig) {
    this.config = {
      enableReplanning: config?.enableReplanning ?? true,
      enableEvidenceStorage: config?.enableEvidenceStorage ?? true,
      maxReplanAttempts: config?.maxReplanAttempts ?? 3,
      planningTimeoutMs: config?.planningTimeoutMs ?? 5000,
    };

    this.planner = new GOAPPlanner({ maxPlanDepth: 15, maxIterations: 3000 });
    this.shannonEngine = new ShannonEngine10();
    this.evidenceEngine = this.config.enableEvidenceStorage ? new EvidenceMemoryEngine() : null;

    if (this.evidenceEngine) {
      this.evidenceEngine.configure({ maxRecords: 5000, decayFunction: "sigmoid" });
    }

    this.registerDefaultActions();
  }

  /**
   * Set current world state
   */
  setWorldState(state: WorldState): void {
    this.worldState = new Map(state);
  }

  /**
   * Get current world state
   */
  getWorldState(): WorldState {
    return new Map(this.worldState);
  }

  /**
   * Update a single world state property
   */
  updateWorldState(key: string, value: boolean | number | string): void {
    this.worldState.set(key, value);
  }

  /**
   * Execute a goal: GOAP plans → Shannon executes → Evidence stores
   */
  async executeGoal(goal: GOAPGoal): Promise<ExecutionResult> {
    const start = Date.now();
    this.stats.totalExecutions++;

    // Phase 1: GOAP Planning
    const plan = this.planner.plan(this.worldState, goal);

    if (!plan.feasible) {
      this.stats.failedPlans++;
      return {
        plan,
        agentResults: [],
        replanned: false,
        replanCount: 0,
        totalLatencyMs: Date.now() - start,
        evidenceIds: [],
        worldStateAfter: new Map(this.worldState),
      };
    }

    // Phase 2: Execute plan steps via Shannon agents
    const agentResults: AgentStepResult[] = [];
    const evidenceIds: string[] = [];
    let replanned = false;
    let replanCount = 0;
    let currentPlan = plan;

    for (let i = 0; i < currentPlan.steps.length; i++) {
      const step = currentPlan.steps[i];
      const agentType = this.mapActionToAgent(step.action.name);

      const stepStart = Date.now();
      const stepResult = await this.executeStep(step.action, agentType, i);
      agentResults.push(stepResult);
      this.stats.totalSteps++;

      if (stepResult.success) {
        // Update world state with action effects
        for (const [key, value] of step.action.effects) {
          this.worldState.set(key, value);
        }

        // Store evidence
        if (this.config.enableEvidenceStorage && this.evidenceEngine && stepResult.output) {
          const evidenceId = await this.storeStepEvidence(step.action.name, stepResult);
          if (evidenceId) evidenceIds.push(evidenceId);
        }
      } else if (this.config.enableReplanning && replanCount < this.config.maxReplanAttempts) {
        // Re-plan from current world state
        replanCount++;
        this.stats.totalReplans++;
        replanned = true;

        const newPlan = this.planner.plan(this.worldState, goal);
        if (newPlan.feasible && newPlan.steps.length > 0) {
          currentPlan = newPlan;
          i = -1; // Restart loop with new plan
          agentResults.length = 0; // Clear previous results
        } else {
          break; // No viable replan
        }
      } else {
        break; // Step failed, no replanning
      }
    }

    const success = this.planner.plan(this.worldState, goal).steps.length === 0; // Goal satisfied?
    if (success) this.stats.successfulPlans++;
    else this.stats.failedPlans++;

    return {
      plan: currentPlan,
      agentResults,
      replanned,
      replanCount,
      totalLatencyMs: Date.now() - start,
      evidenceIds,
      worldStateAfter: new Map(this.worldState),
    };
  }

  /**
   * Execute multiple goals by priority
   */
  async executeGoals(goals: GOAPGoal[]): Promise<ExecutionResult[]> {
    const sorted = [...goals].sort((a, b) => b.priority - a.priority);
    const results: ExecutionResult[] = [];

    for (const goal of sorted) {
      const result = await this.executeGoal(goal);
      results.push(result);
    }

    return results;
  }

  /**
   * Check if a goal is reachable from current world state
   */
  isGoalReachable(goal: GOAPGoal): boolean {
    return this.planner.isAchievable(this.worldState, goal);
  }

  /**
   * Register a custom GOAP action
   */
  registerAction(action: GOAPAction, agentType?: AgentType): void {
    this.planner.addAction(action);
    if (agentType) {
      ACTION_AGENT_MAP[action.name] = agentType;
    }
  }

  /**
   * Get bridge statistics
   */
  getStats() {
    return {
      ...this.stats,
      plannerStats: this.planner.getStats(),
      shannonStats: this.shannonEngine.getStats(),
      worldStateSize: this.worldState.size,
    };
  }

  /**
   * Get the GOAP planner (for advanced configuration)
   */
  getPlanner(): GOAPPlanner {
    return this.planner;
  }

  /**
   * Get the Shannon engine (for advanced configuration)
   */
  getShannonEngine(): ShannonEngine10 {
    return this.shannonEngine;
  }

  // ========== Private Methods ==========

  private registerDefaultActions(): void {
    this.planner.addActions([
      {
        name: "analyze-component",
        preconditions: new Map([["hasDesignFile", true]]),
        effects: new Map([["componentAnalyzed", true]]),
        cost: 2,
      },
      {
        name: "check-accessibility",
        preconditions: new Map([["componentAnalyzed", true]]),
        effects: new Map([["accessibilityChecked", true]]),
        cost: 2,
      },
      {
        name: "optimize-mobile",
        preconditions: new Map([["componentAnalyzed", true]]),
        effects: new Map([["mobileOptimized", true]]),
        cost: 3,
      },
      {
        name: "extract-tokens",
        preconditions: new Map([["componentAnalyzed", true]]),
        effects: new Map([["tokensExtracted", true]]),
        cost: 3,
      },
      {
        name: "generate-code",
        preconditions: new Map([["tokensExtracted", true]]),
        effects: new Map([["codeGenerated", true]]),
        cost: 5,
      },
      {
        name: "validate-output",
        preconditions: new Map([["codeGenerated", true]]),
        effects: new Map([["outputValidated", true]]),
        cost: 2,
      },
      {
        name: "optimize-performance",
        preconditions: new Map([["codeGenerated", true]]),
        effects: new Map([["performanceOptimized", true]]),
        cost: 3,
      },
      {
        name: "generate-docs",
        preconditions: new Map([["codeGenerated", true]]),
        effects: new Map([["docsGenerated", true]]),
        cost: 2,
      },
      {
        name: "generate-tests",
        preconditions: new Map([["codeGenerated", true]]),
        effects: new Map([["testsGenerated", true]]),
        cost: 3,
      },
      {
        name: "store-evidence",
        preconditions: new Map([["outputValidated", true]]),
        effects: new Map([["evidenceStored", true]]),
        cost: 1,
      },
      {
        name: "detect-patterns",
        preconditions: new Map([["componentAnalyzed", true]]),
        effects: new Map([["patternsDetected", true]]),
        cost: 4,
      },
      {
        name: "resolve-contradictions",
        preconditions: new Map([["patternsDetected", true], ["evidenceStored", true]]),
        effects: new Map([["contradictionsResolved", true]]),
        cost: 3,
      },
      {
        name: "deploy",
        preconditions: new Map([["codeGenerated", true], ["testsGenerated", true], ["docsGenerated", true]]),
        effects: new Map([["deployed", true]]),
        cost: 4,
      },
    ]);
  }

  private mapActionToAgent(actionName: string): AgentType {
    return ACTION_AGENT_MAP[actionName] ?? "design-analyzer";
  }

  private async executeStep(
    action: GOAPAction,
    agentType: AgentType,
    stepIndex: number
  ): Promise<AgentStepResult> {
    const start = Date.now();

    try {
      // Simulate agent execution (in production, delegates to real Shannon agent)
      const capability = this.shannonEngine.getAgentCapability(agentType);

      // Simulate success based on agent's success rate
      const success = Math.random() < (capability?.successRate ?? 0.9);

      return {
        stepIndex,
        actionName: action.name,
        agentType,
        success: true, // In simulation, always succeed (real impl uses LLM)
        output: { action: action.name, agent: agentType, simulated: true },
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        stepIndex,
        actionName: action.name,
        agentType,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - start,
      };
    }
  }

  private async storeStepEvidence(
    actionName: string,
    result: AgentStepResult
  ): Promise<string | null> {
    if (!this.evidenceEngine) return null;

    try {
      const id = await this.evidenceEngine.storeEvidence({
        content: `Agent ${result.agentType} completed ${actionName}: ${JSON.stringify(result.output)}`,
        source: "ai-inference" as EvidenceSource,
        confidence: result.success ? 0.7 : 0.3,
        validated: false,
        tags: [actionName, result.agentType, "goap-execution"],
        metadata: { stepIndex: result.stepIndex, latencyMs: result.latencyMs },
      });
      this.stats.totalEvidenceStored++;
      return id;
    } catch {
      return null;
    }
  }
}

// ── Factory ──────────────────────────────────────────────────

export function createGOAPShannonBridge(config?: BridgeConfig): GOAPShannonBridge {
  return new GOAPShannonBridge(config);
}
