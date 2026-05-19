/**
 * GOAP Planner Benchmarks
 *
 * Covers:
 *   • Planning with 5 actions, 3 goals (baseline)
 *   • Planning with 20 actions, 5 goals (stress test)
 */

import { GOAPPlanner, createDesignAgentPlanner, type GOAPAction, type GOAPGoal, type WorldState } from "../web/src/lib/goapPlanner.js";
import { bench, type BenchResult } from "./bench.js";

// ── Helpers ───────────────────────────────────────────────────

function makeAction(name: string, pre: Record<string, boolean>, effects: Record<string, boolean>, cost = 1): GOAPAction {
  return {
    name,
    preconditions: new Map(Object.entries(pre)) as WorldState,
    effects: new Map(Object.entries(effects)) as WorldState,
    cost,
  };
}

function makeGoal(name: string, conditions: Record<string, boolean>, priority = 1): GOAPGoal {
  return {
    name,
    conditions: new Map(Object.entries(conditions)) as WorldState,
    priority,
  };
}

// ── 5-action scenario (design agent baseline) ─────────────────

const SMALL_ACTIONS: GOAPAction[] = [
  makeAction("load-file",      {},                                    { fileLoaded: true },          1),
  makeAction("analyze",        { fileLoaded: true },                  { analyzed: true },            2),
  makeAction("extract-tokens", { analyzed: true },                    { tokensExtracted: true },     3),
  makeAction("gen-code",       { tokensExtracted: true },             { codeGenerated: true },       5),
  makeAction("validate",       { codeGenerated: true },               { validated: true },           2),
];

const SMALL_INITIAL_STATE: WorldState = new Map();

const SMALL_GOALS: GOAPGoal[] = [
  makeGoal("validate-output",   { validated: true },       3),
  makeGoal("extract-tokens",    { tokensExtracted: true }, 2),
  makeGoal("generate-code",     { codeGenerated: true },   1),
];

// ── 20-action stress test scenario ───────────────────────────

function buildLargeScenario(): { planner: GOAPPlanner; state: WorldState; goals: GOAPGoal[] } {
  const planner = new GOAPPlanner({ maxPlanDepth: 15, maxIterations: 5000 });

  // Chain of actions: each requires the previous state flag
  const actions: GOAPAction[] = [
    makeAction("init",          {},                         { a0: true }, 1),
    makeAction("step1",         { a0: true },               { a1: true }, 1),
    makeAction("step2",         { a1: true },               { a2: true }, 1),
    makeAction("step3",         { a2: true },               { a3: true }, 1),
    makeAction("step4",         { a3: true },               { a4: true }, 1),
    makeAction("step5",         { a4: true },               { a5: true }, 1),
    makeAction("step6",         { a5: true },               { a6: true }, 1),
    makeAction("step7",         { a6: true },               { a7: true }, 1),
    makeAction("step8",         { a7: true },               { a8: true }, 1),
    makeAction("step9",         { a8: true },               { a9: true }, 1),
    // Branch B: parallel track
    makeAction("branch-b-init", { a0: true },               { b1: true }, 1),
    makeAction("branch-b-2",    { b1: true },               { b2: true }, 1),
    makeAction("branch-b-3",    { b2: true },               { b3: true }, 1),
    makeAction("merge",         { a5: true, b2: true },     { merged: true }, 2),
    makeAction("finalize",      { merged: true },            { done: true }, 1),
    // Shortcut actions (higher cost)
    makeAction("shortcut-ab",   { a0: true },               { a5: true, b2: true }, 8),
    makeAction("quick-merge",   { a3: true },               { merged: true },       6),
    makeAction("validate-a",    { a9: true },               { aValidated: true },   2),
    makeAction("validate-b",    { b3: true },               { bValidated: true },   2),
    makeAction("publish",       { done: true, aValidated: true }, { published: true }, 3),
  ];

  planner.addActions(actions);

  const state: WorldState = new Map();

  const goals: GOAPGoal[] = [
    makeGoal("finish",         { done: true },      5),
    makeGoal("validate-a",     { aValidated: true }, 4),
    makeGoal("validate-b",     { bValidated: true }, 3),
    makeGoal("get-to-step5",   { a5: true },        2),
    makeGoal("merge-branches", { merged: true },    1),
  ];

  return { planner, state, goals };
}

export function runGOAPBenchmarks(): BenchResult[] {
  const results: BenchResult[] = [];

  // ── Benchmark 1: 5 actions, 3 goals ──────────────────────────
  try {
    results.push(
      bench(
        "GOAP: plan with 5 actions, 3 goals",
        () => {
          // Fresh planner each call so cache doesn't inflate results
          const planner = new GOAPPlanner({ enablePlanCache: false });
          planner.addActions(SMALL_ACTIONS);
          for (const goal of SMALL_GOALS) {
            planner.plan(SMALL_INITIAL_STATE, goal);
          }
        },
        200,
      ),
    );
  } catch (err) {
    console.error("GOAP small benchmark failed:", err);
  }

  // ── Benchmark 2: Design agent planner (pre-built, cached) ─────
  try {
    const designPlanner = createDesignAgentPlanner({ enablePlanCache: false });
    const designState: WorldState = new Map([["hasDesignFile", true]]);
    const designGoal = makeGoal("store-evidence", { evidenceStored: true }, 5);

    results.push(
      bench(
        "GOAP: design agent planner (7 actions)",
        () => {
          designPlanner.plan(designState, designGoal);
        },
        300,
      ),
    );
  } catch (err) {
    console.error("GOAP design-agent benchmark failed:", err);
  }

  // ── Benchmark 3: 20 actions, 5 goals (stress test) ───────────
  try {
    const { planner: largePlanner, state: largeState, goals: largeGoals } = buildLargeScenario();
    // Disable cache so each plan call is independently measured
    const stressPlanner = new GOAPPlanner({ maxPlanDepth: 15, maxIterations: 5000, enablePlanCache: false });
    stressPlanner.addActions(largePlanner.getActions());

    results.push(
      bench(
        "GOAP: 20 actions, 5 goals (stress test)",
        () => {
          for (const goal of largeGoals) {
            stressPlanner.plan(largeState, goal);
          }
        },
        50,
      ),
    );
  } catch (err) {
    console.error("GOAP stress benchmark failed:", err);
  }

  return results;
}
