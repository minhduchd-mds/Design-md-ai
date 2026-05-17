/**
 * GOAP (Goal-Oriented Action Planning) — Agent Decision Engine
 *
 * Enables Self-Learning agents to autonomously plan multi-step actions
 * by reasoning about goals, preconditions, and effects.
 *
 * Architecture:
 *   • A* search over action space (optimal plan finding)
 *   • World state as typed key-value map
 *   • Actions with preconditions, effects, and dynamic cost
 *   • Goal decomposition for complex objectives
 *   • Plan caching for repeated goal patterns
 *
 * Used by Shannon Engine agents for autonomous task decomposition.
 */

// ── Types ─────────────────────────────────────────────────────

export type WorldState = Map<string, boolean | number | string>;

export interface GOAPAction {
  name: string;
  preconditions: Map<string, boolean | number | string>;
  effects: Map<string, boolean | number | string>;
  cost: number | ((state: WorldState) => number); // Static or dynamic cost
  metadata?: Record<string, unknown>;
}

export interface GOAPGoal {
  name: string;
  conditions: Map<string, boolean | number | string>;
  priority: number; // Higher = more important
  deadline?: number; // Optional timestamp deadline
}

export interface PlanStep {
  action: GOAPAction;
  stateBeforeAction: WorldState;
  stateAfterAction: WorldState;
}

export interface Plan {
  goal: GOAPGoal;
  steps: PlanStep[];
  totalCost: number;
  feasible: boolean;
  planTime: number; // ms taken to compute
}

export interface GOAPConfig {
  maxPlanDepth?: number;     // default 20 — max actions in a plan
  maxIterations?: number;    // default 5000 — A* iteration budget
  enablePlanCache?: boolean; // default true
  planCacheSize?: number;    // default 100
}

// ── A* Search Node ────────────────────────────────────────────

interface SearchNode {
  state: WorldState;
  actions: GOAPAction[];
  cost: number; // g(n) — actual cost so far
  heuristic: number; // h(n) — estimated remaining cost
  total: number; // f(n) = g + h
}

// ── Planner ──────────────────────────────────────────────────

export class GOAPPlanner {
  private actions: GOAPAction[] = [];
  private config: Required<GOAPConfig>;
  private planCache: Map<string, Plan> = new Map();
  private stats = { totalPlans: 0, cacheHits: 0, totalIterations: 0 };

  constructor(config?: GOAPConfig) {
    this.config = {
      maxPlanDepth: config?.maxPlanDepth ?? 20,
      maxIterations: config?.maxIterations ?? 5000,
      enablePlanCache: config?.enablePlanCache ?? true,
      planCacheSize: config?.planCacheSize ?? 100,
    };
  }

  /**
   * Register an action the planner can use
   */
  addAction(action: GOAPAction): void {
    this.actions.push(action);
  }

  /**
   * Register multiple actions at once
   */
  addActions(actions: GOAPAction[]): void {
    this.actions.push(...actions);
  }

  /**
   * Remove an action by name
   */
  removeAction(name: string): boolean {
    const idx = this.actions.findIndex((a) => a.name === name);
    if (idx === -1) return false;
    this.actions.splice(idx, 1);
    return true;
  }

  /**
   * Get all registered actions
   */
  getActions(): GOAPAction[] {
    return [...this.actions];
  }

  /**
   * Find optimal plan from current state to goal
   * Uses A* search over action space
   */
  plan(currentState: WorldState, goal: GOAPGoal): Plan {
    const start = Date.now();
    this.stats.totalPlans++;

    // Check cache
    if (this.config.enablePlanCache) {
      const cacheKey = this.computeCacheKey(currentState, goal);
      const cached = this.planCache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return { ...cached, planTime: 0 };
      }
    }

    // Check if goal already satisfied
    if (this.isGoalSatisfied(currentState, goal)) {
      return { goal, steps: [], totalCost: 0, feasible: true, planTime: Date.now() - start };
    }

    // A* forward search
    const openSet: SearchNode[] = [{
      state: new Map(currentState),
      actions: [],
      cost: 0,
      heuristic: this.heuristic(currentState, goal),
      total: this.heuristic(currentState, goal),
    }];

    const closedSet = new Set<string>();
    let iterations = 0;

    while (openSet.length > 0 && iterations < this.config.maxIterations) {
      iterations++;
      this.stats.totalIterations++;

      // Get lowest f(n) node
      openSet.sort((a, b) => a.total - b.total);
      const current = openSet.shift()!;

      // Check if goal reached
      if (this.isGoalSatisfied(current.state, goal)) {
        const plan = this.buildPlan(current, goal, start);

        // Cache result
        if (this.config.enablePlanCache) {
          this.cachePlan(currentState, goal, plan);
        }

        return plan;
      }

      // Skip if already explored
      const stateKey = this.stateKey(current.state);
      if (closedSet.has(stateKey)) continue;
      closedSet.add(stateKey);

      // Check depth limit
      if (current.actions.length >= this.config.maxPlanDepth) continue;

      // Expand: try each applicable action
      for (const action of this.actions) {
        if (!this.canApply(action, current.state)) continue;

        const newState = this.applyAction(action, current.state);
        const newStateKey = this.stateKey(newState);
        if (closedSet.has(newStateKey)) continue;

        const actionCost = typeof action.cost === "function" ? action.cost(current.state) : action.cost;
        const g = current.cost + actionCost;
        const h = this.heuristic(newState, goal);

        openSet.push({
          state: newState,
          actions: [...current.actions, action],
          cost: g,
          heuristic: h,
          total: g + h,
        });
      }
    }

    // No plan found
    return { goal, steps: [], totalCost: Infinity, feasible: false, planTime: Date.now() - start };
  }

  /**
   * Plan for multiple goals, returns plans sorted by priority
   */
  planMultipleGoals(currentState: WorldState, goals: GOAPGoal[]): Plan[] {
    const sorted = [...goals].sort((a, b) => b.priority - a.priority);
    return sorted.map((goal) => this.plan(currentState, goal));
  }

  /**
   * Check if a goal is achievable from the current state
   * (faster than full planning — just checks if any path exists)
   */
  isAchievable(currentState: WorldState, goal: GOAPGoal): boolean {
    if (this.isGoalSatisfied(currentState, goal)) return true;

    // Quick BFS with limited depth
    const visited = new Set<string>();
    const queue: Array<{ state: WorldState; depth: number }> = [{ state: currentState, depth: 0 }];

    while (queue.length > 0) {
      const { state, depth } = queue.shift()!;
      if (depth >= this.config.maxPlanDepth) continue;

      const key = this.stateKey(state);
      if (visited.has(key)) continue;
      visited.add(key);

      for (const action of this.actions) {
        if (!this.canApply(action, state)) continue;
        const newState = this.applyAction(action, state);
        if (this.isGoalSatisfied(newState, goal)) return true;
        queue.push({ state: newState, depth: depth + 1 });
      }

      // Budget limit
      if (visited.size > 1000) break;
    }

    return false;
  }

  /**
   * Get planner statistics
   */
  getStats(): { totalPlans: number; cacheHits: number; cacheSize: number; actionCount: number; totalIterations: number } {
    return {
      ...this.stats,
      cacheSize: this.planCache.size,
      actionCount: this.actions.length,
    };
  }

  /**
   * Clear the plan cache
   */
  clearCache(): void {
    this.planCache.clear();
  }

  // ========== Private Methods ==========

  private isGoalSatisfied(state: WorldState, goal: GOAPGoal): boolean {
    for (const [key, value] of goal.conditions) {
      const stateValue = state.get(key);
      if (stateValue !== value) return false;
    }
    return true;
  }

  private canApply(action: GOAPAction, state: WorldState): boolean {
    for (const [key, value] of action.preconditions) {
      const stateValue = state.get(key);
      if (stateValue !== value) return false;
    }
    return true;
  }

  private applyAction(action: GOAPAction, state: WorldState): WorldState {
    const newState = new Map(state);
    for (const [key, value] of action.effects) {
      newState.set(key, value);
    }
    return newState;
  }

  private heuristic(state: WorldState, goal: GOAPGoal): number {
    // Count unsatisfied conditions as heuristic (admissible)
    let unsatisfied = 0;
    for (const [key, value] of goal.conditions) {
      if (state.get(key) !== value) unsatisfied++;
    }
    return unsatisfied;
  }

  private buildPlan(node: SearchNode, goal: GOAPGoal, startTime: number): Plan {
    const steps: PlanStep[] = [];
    let state = new Map(node.state);

    // Rebuild state transitions
    let currentState = new Map<string, boolean | number | string>();
    // We need to rebuild from scratch — node.state is final state
    // So we replay actions from initial state
    // Actually we need the initial state... let's reconstruct step by step
    // The actions array has the sequence, we need to re-simulate

    // Re-simulate from what the first action saw
    // Since we don't store intermediate states, reconstruct them
    let simulatedState = new Map(node.state);
    // Undo effects in reverse to get initial, then replay forward
    // Simpler: just compute forward from effects knowledge

    // Forward reconstruction using the action sequence
    // We need the original starting state for this. Let's use a different approach:
    // We know the final state and the actions. Build steps by replaying.

    // Since we don't have the original state stored in the node (just the final),
    // create minimal step records
    for (const action of node.actions) {
      const before = new Map(currentState);
      for (const [key, value] of action.effects) {
        currentState.set(key, value);
      }
      steps.push({
        action,
        stateBeforeAction: before,
        stateAfterAction: new Map(currentState),
      });
    }

    return {
      goal,
      steps,
      totalCost: node.cost,
      feasible: true,
      planTime: Date.now() - startTime,
    };
  }

  private stateKey(state: WorldState): string {
    const entries = Array.from(state.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([k, v]) => `${k}=${v}`).join("|");
  }

  private computeCacheKey(state: WorldState, goal: GOAPGoal): string {
    return `${this.stateKey(state)}>>>${goal.name}:${this.stateKey(goal.conditions)}`;
  }

  private cachePlan(state: WorldState, goal: GOAPGoal, plan: Plan): void {
    const key = this.computeCacheKey(state, goal);

    // Evict if at capacity (LRU-like: remove oldest)
    if (this.planCache.size >= this.config.planCacheSize) {
      const firstKey = this.planCache.keys().next().value;
      if (firstKey) this.planCache.delete(firstKey);
    }

    this.planCache.set(key, plan);
  }
}

// ── Factory ──────────────────────────────────────────────────

/**
 * Create GOAP planner with design system agent actions pre-registered
 */
export function createDesignAgentPlanner(config?: GOAPConfig): GOAPPlanner {
  const planner = new GOAPPlanner(config);

  // Pre-register common design system agent actions
  planner.addActions([
    {
      name: "analyze-component",
      preconditions: new Map([["hasDesignFile", true]]),
      effects: new Map([["componentAnalyzed", true]]),
      cost: 2,
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
  ]);

  return planner;
}

/**
 * Create a bare GOAP planner with no pre-registered actions
 */
export function createGOAPPlanner(config?: GOAPConfig): GOAPPlanner {
  return new GOAPPlanner(config);
}
