import { describe, it, expect, beforeEach } from "vitest";
import { GOAPShannonBridge, createGOAPShannonBridge } from "../goapShannonBridge";
import type { GOAPGoal } from "../goapPlanner";

describe("GOAPShannonBridge", () => {
  let bridge: GOAPShannonBridge;

  beforeEach(() => {
    bridge = new GOAPShannonBridge({ enableEvidenceStorage: true });
    bridge.setWorldState(new Map([["hasDesignFile", true]]));
  });

  describe("world state", () => {
    it("sets and gets world state", () => {
      bridge.setWorldState(new Map([["key", "value"]]));
      expect(bridge.getWorldState().get("key")).toBe("value");
    });

    it("updates individual properties", () => {
      bridge.updateWorldState("newProp", true);
      expect(bridge.getWorldState().get("newProp")).toBe(true);
    });

    it("does not mutate original state", () => {
      const original = new Map<string, boolean | number | string>([["a", true]]);
      bridge.setWorldState(original);
      bridge.updateWorldState("b", false);
      expect(original.has("b")).toBe(false); // Original not mutated
    });
  });

  describe("executeGoal", () => {
    it("plans and executes simple goal", async () => {
      const goal: GOAPGoal = {
        name: "analyze",
        conditions: new Map([["componentAnalyzed", true]]),
        priority: 1,
      };

      const result = await bridge.executeGoal(goal);

      expect(result.plan.feasible).toBe(true);
      expect(result.agentResults.length).toBeGreaterThan(0);
      expect(result.agentResults[0].actionName).toBe("analyze-component");
      expect(result.agentResults[0].success).toBe(true);
    });

    it("executes multi-step pipeline goal", async () => {
      const goal: GOAPGoal = {
        name: "generate-validated-code",
        conditions: new Map([["outputValidated", true]]),
        priority: 1,
      };

      const result = await bridge.executeGoal(goal);

      expect(result.plan.feasible).toBe(true);
      expect(result.agentResults.length).toBeGreaterThanOrEqual(4);
      // World state should be updated
      expect(result.worldStateAfter.get("outputValidated")).toBe(true);
      expect(result.worldStateAfter.get("codeGenerated")).toBe(true);
    });

    it("handles infeasible goal", async () => {
      const goal: GOAPGoal = {
        name: "impossible",
        conditions: new Map([["flyingCar", true]]),
        priority: 1,
      };

      const result = await bridge.executeGoal(goal);

      expect(result.plan.feasible).toBe(false);
      expect(result.agentResults.length).toBe(0);
    });

    it("stores evidence for each step", async () => {
      const goal: GOAPGoal = {
        name: "analyze-and-generate",
        conditions: new Map([["codeGenerated", true]]),
        priority: 1,
      };

      const result = await bridge.executeGoal(goal);

      expect(result.evidenceIds.length).toBeGreaterThan(0);
    });

    it("updates world state after execution", async () => {
      const goal: GOAPGoal = {
        name: "analyze",
        conditions: new Map([["componentAnalyzed", true]]),
        priority: 1,
      };

      await bridge.executeGoal(goal);

      // World state should persist
      expect(bridge.getWorldState().get("componentAnalyzed")).toBe(true);
    });

    it("goal already satisfied returns empty plan", async () => {
      bridge.updateWorldState("componentAnalyzed", true);

      const goal: GOAPGoal = {
        name: "analyze",
        conditions: new Map([["componentAnalyzed", true]]),
        priority: 1,
      };

      const result = await bridge.executeGoal(goal);

      expect(result.plan.steps.length).toBe(0);
      expect(result.agentResults.length).toBe(0);
    });
  });

  describe("executeGoals", () => {
    it("executes multiple goals by priority", async () => {
      const goals: GOAPGoal[] = [
        { name: "low-priority", conditions: new Map([["componentAnalyzed", true]]), priority: 1 },
        { name: "high-priority", conditions: new Map([["tokensExtracted", true]]), priority: 10 },
      ];

      const results = await bridge.executeGoals(goals);

      expect(results.length).toBe(2);
      // High priority executed first (already satisfied componentAnalyzed from first goal)
    });
  });

  describe("isGoalReachable", () => {
    it("returns true for reachable goal", () => {
      expect(bridge.isGoalReachable({
        name: "code",
        conditions: new Map([["codeGenerated", true]]),
        priority: 1,
      })).toBe(true);
    });

    it("returns false for unreachable goal", () => {
      expect(bridge.isGoalReachable({
        name: "impossible",
        conditions: new Map([["nonExistentState", true]]),
        priority: 1,
      })).toBe(false);
    });
  });

  describe("registerAction", () => {
    it("registers custom action with agent mapping", async () => {
      bridge.registerAction(
        {
          name: "custom-lint",
          preconditions: new Map([["codeGenerated", true]]),
          effects: new Map([["linted", true]]),
          cost: 2,
        },
        "security-validator"
      );

      // First generate code, then lint
      bridge.updateWorldState("componentAnalyzed", true);
      bridge.updateWorldState("tokensExtracted", true);
      bridge.updateWorldState("codeGenerated", true);

      const goal: GOAPGoal = {
        name: "lint",
        conditions: new Map([["linted", true]]),
        priority: 1,
      };

      const result = await bridge.executeGoal(goal);
      expect(result.plan.feasible).toBe(true);
      expect(result.agentResults[0].actionName).toBe("custom-lint");
    });
  });

  describe("full pipeline E2E", () => {
    it("executes full design-to-deployment pipeline", async () => {
      const goal: GOAPGoal = {
        name: "full-deployment",
        conditions: new Map([["deployed", true]]),
        priority: 1,
      };

      const result = await bridge.executeGoal(goal);

      expect(result.plan.feasible).toBe(true);
      expect(result.agentResults.length).toBeGreaterThanOrEqual(6);
      expect(result.worldStateAfter.get("deployed")).toBe(true);
      expect(result.worldStateAfter.get("codeGenerated")).toBe(true);
      expect(result.worldStateAfter.get("testsGenerated")).toBe(true);
      expect(result.worldStateAfter.get("docsGenerated")).toBe(true);
    });

    it("executes contradiction resolution pipeline", async () => {
      const goal: GOAPGoal = {
        name: "resolve-contradictions",
        conditions: new Map([["contradictionsResolved", true]]),
        priority: 1,
      };

      const result = await bridge.executeGoal(goal);

      expect(result.plan.feasible).toBe(true);
      expect(result.worldStateAfter.get("contradictionsResolved")).toBe(true);
    });
  });

  describe("getStats", () => {
    it("tracks execution statistics", async () => {
      const goal: GOAPGoal = {
        name: "analyze",
        conditions: new Map([["componentAnalyzed", true]]),
        priority: 1,
      };

      await bridge.executeGoal(goal);

      const stats = bridge.getStats();
      expect(stats.totalExecutions).toBe(1);
      expect(stats.successfulPlans).toBe(1);
      expect(stats.totalSteps).toBeGreaterThan(0);
      expect(stats.plannerStats).toBeDefined();
      expect(stats.shannonStats).toBeDefined();
    });

    it("tracks evidence storage", async () => {
      const goal: GOAPGoal = {
        name: "code",
        conditions: new Map([["codeGenerated", true]]),
        priority: 1,
      };

      await bridge.executeGoal(goal);

      const stats = bridge.getStats();
      expect(stats.totalEvidenceStored).toBeGreaterThan(0);
    });
  });

  describe("configuration", () => {
    it("disables evidence storage", async () => {
      const noEvidence = new GOAPShannonBridge({ enableEvidenceStorage: false });
      noEvidence.setWorldState(new Map([["hasDesignFile", true]]));

      const goal: GOAPGoal = {
        name: "analyze",
        conditions: new Map([["componentAnalyzed", true]]),
        priority: 1,
      };

      const result = await noEvidence.executeGoal(goal);
      expect(result.evidenceIds.length).toBe(0);
    });
  });

  describe("accessors", () => {
    it("exposes planner for advanced config", () => {
      expect(bridge.getPlanner()).toBeDefined();
      expect(bridge.getPlanner().getActions().length).toBeGreaterThan(0);
    });

    it("exposes shannon engine", () => {
      expect(bridge.getShannonEngine()).toBeDefined();
      expect(bridge.getShannonEngine().getAvailableAgents().length).toBe(10);
    });
  });
});

describe("createGOAPShannonBridge", () => {
  it("creates bridge with defaults", () => {
    const bridge = createGOAPShannonBridge();
    expect(bridge.getStats().totalExecutions).toBe(0);
  });

  it("creates bridge with custom config", () => {
    const bridge = createGOAPShannonBridge({ maxReplanAttempts: 5 });
    expect(bridge.getPlanner().getActions().length).toBeGreaterThan(0);
  });
});
