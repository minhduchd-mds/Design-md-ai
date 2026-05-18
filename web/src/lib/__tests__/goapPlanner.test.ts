import { describe, it, expect, beforeEach } from "vitest";
import { GOAPPlanner, GOAPGoal, WorldState, createDesignAgentPlanner, createGOAPPlanner } from "../goapPlanner";

describe("GOAPPlanner", () => {
  let planner: GOAPPlanner;

  beforeEach(() => {
    planner = new GOAPPlanner({ maxPlanDepth: 10, maxIterations: 1000 });
  });

  describe("addAction", () => {
    it("registers an action", () => {
      planner.addAction({
        name: "move",
        preconditions: new Map([["atA", true]]),
        effects: new Map([["atB", true], ["atA", false]]),
        cost: 1,
      });

      expect(planner.getActions().length).toBe(1);
      expect(planner.getActions()[0].name).toBe("move");
    });

    it("registers multiple actions", () => {
      planner.addActions([
        { name: "a1", preconditions: new Map(), effects: new Map(), cost: 1 },
        { name: "a2", preconditions: new Map(), effects: new Map(), cost: 2 },
      ]);

      expect(planner.getActions().length).toBe(2);
    });
  });

  describe("removeAction", () => {
    it("removes existing action", () => {
      planner.addAction({ name: "test", preconditions: new Map(), effects: new Map(), cost: 1 });
      expect(planner.removeAction("test")).toBe(true);
      expect(planner.getActions().length).toBe(0);
    });

    it("returns false for non-existent action", () => {
      expect(planner.removeAction("nonexistent")).toBe(false);
    });
  });

  describe("plan", () => {
    beforeEach(() => {
      // Classic GOAP example: woodcutter
      planner.addActions([
        {
          name: "get-axe",
          preconditions: new Map([["hasAxe", false]]),
          effects: new Map([["hasAxe", true]]),
          cost: 2,
        },
        {
          name: "chop-tree",
          preconditions: new Map([["hasAxe", true]]),
          effects: new Map([["hasWood", true]]),
          cost: 4,
        },
        {
          name: "make-fire",
          preconditions: new Map([["hasWood", true]]),
          effects: new Map([["hasFire", true]]),
          cost: 1,
        },
      ]);
    });

    it("finds optimal plan for simple goal", () => {
      const state: WorldState = new Map([["hasAxe", false], ["hasWood", false], ["hasFire", false]]);
      const goal: GOAPGoal = { name: "make-fire", conditions: new Map([["hasFire", true]]), priority: 1 };

      const plan = planner.plan(state, goal);

      expect(plan.feasible).toBe(true);
      expect(plan.steps.length).toBe(3);
      expect(plan.steps[0].action.name).toBe("get-axe");
      expect(plan.steps[1].action.name).toBe("chop-tree");
      expect(plan.steps[2].action.name).toBe("make-fire");
      expect(plan.totalCost).toBe(7);
    });

    it("skips unnecessary actions", () => {
      const state: WorldState = new Map([["hasAxe", true], ["hasWood", false], ["hasFire", false]]);
      const goal: GOAPGoal = { name: "make-fire", conditions: new Map([["hasFire", true]]), priority: 1 };

      const plan = planner.plan(state, goal);

      expect(plan.feasible).toBe(true);
      expect(plan.steps.length).toBe(2);
      expect(plan.totalCost).toBe(5);
    });

    it("returns empty plan if goal already satisfied", () => {
      const state: WorldState = new Map([["hasFire", true]]);
      const goal: GOAPGoal = { name: "fire", conditions: new Map([["hasFire", true]]), priority: 1 };

      const plan = planner.plan(state, goal);

      expect(plan.feasible).toBe(true);
      expect(plan.steps.length).toBe(0);
      expect(plan.totalCost).toBe(0);
    });

    it("returns infeasible when no path exists", () => {
      const state: WorldState = new Map([["hasAxe", false]]);
      const goal: GOAPGoal = { name: "impossible", conditions: new Map([["flying", true]]), priority: 1 };

      const plan = planner.plan(state, goal);

      expect(plan.feasible).toBe(false);
      expect(plan.totalCost).toBe(Infinity);
    });

    it("respects max plan depth", () => {
      const shallowPlanner = new GOAPPlanner({ maxPlanDepth: 2 });
      shallowPlanner.addActions([
        { name: "a", preconditions: new Map(), effects: new Map([["step1", true]]), cost: 1 },
        { name: "b", preconditions: new Map([["step1", true]]), effects: new Map([["step2", true]]), cost: 1 },
        { name: "c", preconditions: new Map([["step2", true]]), effects: new Map([["step3", true]]), cost: 1 },
      ]);

      const state: WorldState = new Map();
      const goal: GOAPGoal = { name: "deep", conditions: new Map([["step3", true]]), priority: 1 };

      const plan = shallowPlanner.plan(state, goal);
      expect(plan.feasible).toBe(false); // Needs 3 steps but max is 2
    });

    it("handles dynamic cost functions", () => {
      const dynamicPlanner = new GOAPPlanner();
      dynamicPlanner.addActions([
        {
          name: "expensive-when-tired",
          preconditions: new Map(),
          effects: new Map([["done", true]]),
          cost: (state) => state.get("energy") === 0 ? 100 : 1,
        },
      ]);

      const tiredState: WorldState = new Map([["energy", 0]]);
      const freshState: WorldState = new Map([["energy", 10]]);
      const goal: GOAPGoal = { name: "finish", conditions: new Map([["done", true]]), priority: 1 };

      const tiredPlan = dynamicPlanner.plan(tiredState, goal);
      const freshPlan = dynamicPlanner.plan(freshState, goal);

      expect(tiredPlan.totalCost).toBe(100);
      expect(freshPlan.totalCost).toBe(1);
    });

    it("selects cheaper path when multiple exist", () => {
      const multiPlanner = new GOAPPlanner();
      multiPlanner.addActions([
        { name: "expensive-path", preconditions: new Map(), effects: new Map([["done", true]]), cost: 10 },
        { name: "cheap-path", preconditions: new Map(), effects: new Map([["done", true]]), cost: 1 },
      ]);

      const state: WorldState = new Map();
      const goal: GOAPGoal = { name: "finish", conditions: new Map([["done", true]]), priority: 1 };

      const plan = multiPlanner.plan(state, goal);
      expect(plan.steps[0].action.name).toBe("cheap-path");
      expect(plan.totalCost).toBe(1);
    });
  });

  describe("plan caching", () => {
    beforeEach(() => {
      planner.addAction({
        name: "simple",
        preconditions: new Map(),
        effects: new Map([["done", true]]),
        cost: 1,
      });
    });

    it("caches plans for repeated goals", () => {
      const state: WorldState = new Map();
      const goal: GOAPGoal = { name: "finish", conditions: new Map([["done", true]]), priority: 1 };

      planner.plan(state, goal);
      const stats1 = planner.getStats();
      expect(stats1.cacheHits).toBe(0);

      planner.plan(state, goal);
      const stats2 = planner.getStats();
      expect(stats2.cacheHits).toBe(1);
    });

    it("cache can be cleared", () => {
      const state: WorldState = new Map();
      const goal: GOAPGoal = { name: "finish", conditions: new Map([["done", true]]), priority: 1 };

      planner.plan(state, goal);
      planner.clearCache();

      planner.plan(state, goal);
      expect(planner.getStats().cacheHits).toBe(0); // No hit after clear
    });

    it("disables caching when configured", () => {
      const noCachePlanner = new GOAPPlanner({ enablePlanCache: false });
      noCachePlanner.addAction({
        name: "act",
        preconditions: new Map(),
        effects: new Map([["done", true]]),
        cost: 1,
      });

      const state: WorldState = new Map();
      const goal: GOAPGoal = { name: "g", conditions: new Map([["done", true]]), priority: 1 };

      noCachePlanner.plan(state, goal);
      noCachePlanner.plan(state, goal);

      expect(noCachePlanner.getStats().cacheHits).toBe(0);
    });
  });

  describe("planMultipleGoals", () => {
    beforeEach(() => {
      planner.addActions([
        { name: "a", preconditions: new Map(), effects: new Map([["goalA", true]]), cost: 1 },
        { name: "b", preconditions: new Map(), effects: new Map([["goalB", true]]), cost: 2 },
      ]);
    });

    it("plans for multiple goals sorted by priority", () => {
      const state: WorldState = new Map();
      const goals: GOAPGoal[] = [
        { name: "low", conditions: new Map([["goalA", true]]), priority: 1 },
        { name: "high", conditions: new Map([["goalB", true]]), priority: 10 },
      ];

      const plans = planner.planMultipleGoals(state, goals);

      expect(plans.length).toBe(2);
      expect(plans[0].goal.name).toBe("high"); // Higher priority first
      expect(plans[1].goal.name).toBe("low");
    });
  });

  describe("isAchievable", () => {
    beforeEach(() => {
      planner.addActions([
        { name: "step1", preconditions: new Map(), effects: new Map([["a", true]]), cost: 1 },
        { name: "step2", preconditions: new Map([["a", true]]), effects: new Map([["b", true]]), cost: 1 },
      ]);
    });

    it("returns true for achievable goal", () => {
      const state: WorldState = new Map();
      const goal: GOAPGoal = { name: "reach-b", conditions: new Map([["b", true]]), priority: 1 };

      expect(planner.isAchievable(state, goal)).toBe(true);
    });

    it("returns false for impossible goal", () => {
      const state: WorldState = new Map();
      const goal: GOAPGoal = { name: "impossible", conditions: new Map([["z", true]]), priority: 1 };

      expect(planner.isAchievable(state, goal)).toBe(false);
    });

    it("returns true if goal already satisfied", () => {
      const state: WorldState = new Map([["b", true]]);
      const goal: GOAPGoal = { name: "done", conditions: new Map([["b", true]]), priority: 1 };

      expect(planner.isAchievable(state, goal)).toBe(true);
    });
  });

  describe("getStats", () => {
    it("tracks planning statistics", () => {
      planner.addAction({ name: "act", preconditions: new Map(), effects: new Map([["done", true]]), cost: 1 });

      const state: WorldState = new Map();
      const goal: GOAPGoal = { name: "g", conditions: new Map([["done", true]]), priority: 1 };

      planner.plan(state, goal);
      planner.plan(state, goal); // cache hit

      const stats = planner.getStats();
      expect(stats.totalPlans).toBe(2);
      expect(stats.cacheHits).toBe(1);
      expect(stats.actionCount).toBe(1);
      expect(stats.totalIterations).toBeGreaterThan(0);
    });

    it("reports initial state", () => {
      const stats = planner.getStats();
      expect(stats.totalPlans).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe("complex scenarios", () => {
    it("solves multi-condition goals", () => {
      planner.addActions([
        { name: "gather-materials", preconditions: new Map(), effects: new Map([["hasMaterials", true]]), cost: 3 },
        { name: "get-tools", preconditions: new Map(), effects: new Map([["hasTools", true]]), cost: 2 },
        { name: "build", preconditions: new Map([["hasMaterials", true], ["hasTools", true]]), effects: new Map([["houseBuilt", true]]), cost: 10 },
      ]);

      const state: WorldState = new Map([["hasMaterials", false], ["hasTools", false]]);
      const goal: GOAPGoal = { name: "build-house", conditions: new Map([["houseBuilt", true]]), priority: 1 };

      const plan = planner.plan(state, goal);
      expect(plan.feasible).toBe(true);
      expect(plan.steps.length).toBe(3);
      expect(plan.totalCost).toBe(15);
    });

    it("handles string state values", () => {
      planner.addActions([
        { name: "move-to-shop", preconditions: new Map([["location", "home"]]), effects: new Map([["location", "shop"]]), cost: 2 },
        { name: "buy-food", preconditions: new Map([["location", "shop"]]), effects: new Map([["hasFood", true]]), cost: 5 },
      ]);

      const state: WorldState = new Map([["location", "home"], ["hasFood", false]]);
      const goal: GOAPGoal = { name: "get-food", conditions: new Map([["hasFood", true]]), priority: 1 };

      const plan = planner.plan(state, goal);
      expect(plan.feasible).toBe(true);
      expect(plan.steps.length).toBe(2);
    });

    it("handles numeric state values", () => {
      planner.addActions([
        { name: "earn-money", preconditions: new Map([["employed", true]]), effects: new Map([["wealth", 100]]), cost: 8 },
        { name: "get-job", preconditions: new Map(), effects: new Map([["employed", true]]), cost: 5 },
      ]);

      const state: WorldState = new Map([["employed", false], ["wealth", 0]]);
      const goal: GOAPGoal = { name: "get-rich", conditions: new Map([["wealth", 100]]), priority: 1 };

      const plan = planner.plan(state, goal);
      expect(plan.feasible).toBe(true);
      expect(plan.totalCost).toBe(13);
    });
  });

  describe("performance", () => {
    it("finds plan within iteration budget", () => {
      // Create a chain of 10 actions
      for (let i = 0; i < 10; i++) {
        planner.addAction({
          name: `step-${i}`,
          preconditions: i === 0 ? new Map() : new Map([[`done-${i - 1}`, true]]),
          effects: new Map([[`done-${i}`, true]]),
          cost: 1,
        });
      }

      const state: WorldState = new Map();
      const goal: GOAPGoal = { name: "complete", conditions: new Map([["done-9", true]]), priority: 1 };

      const start = Date.now();
      const plan = planner.plan(state, goal);
      const elapsed = Date.now() - start;

      expect(plan.feasible).toBe(true);
      expect(plan.steps.length).toBe(10);
      expect(elapsed).toBeLessThan(500); // Should be fast
    });
  });
});

describe("createDesignAgentPlanner", () => {
  it("creates planner with pre-registered design actions", () => {
    const planner = createDesignAgentPlanner();
    const actions = planner.getActions();

    expect(actions.length).toBe(7);
    expect(actions.map((a) => a.name)).toContain("analyze-component");
    expect(actions.map((a) => a.name)).toContain("generate-code");
    expect(actions.map((a) => a.name)).toContain("store-evidence");
  });

  it("solves design system pipeline goal", () => {
    const planner = createDesignAgentPlanner();

    const state: WorldState = new Map([["hasDesignFile", true]]);
    const goal: GOAPGoal = {
      name: "full-pipeline",
      conditions: new Map([["evidenceStored", true]]),
      priority: 1,
    };

    const plan = planner.plan(state, goal);
    expect(plan.feasible).toBe(true);
    expect(plan.steps.length).toBeGreaterThanOrEqual(4);
  });

  it("can find contradiction resolution path", () => {
    const planner = createDesignAgentPlanner();

    const state: WorldState = new Map([["hasDesignFile", true]]);
    const goal: GOAPGoal = {
      name: "resolve-all",
      conditions: new Map([["contradictionsResolved", true]]),
      priority: 2,
    };

    const plan = planner.plan(state, goal);
    expect(plan.feasible).toBe(true);
  });
});

describe("createGOAPPlanner", () => {
  it("creates bare planner with no actions", () => {
    const planner = createGOAPPlanner();
    expect(planner.getActions().length).toBe(0);
  });

  it("accepts custom config", () => {
    const planner = createGOAPPlanner({ maxPlanDepth: 5 });
    expect(planner.getStats().totalPlans).toBe(0);
  });
});
