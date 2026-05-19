/**
 * useAgentRunner — React hook bridging UI to Agent Fleet v6.
 *
 * Tier 3 wiring layer: provides a simple API for React components to trigger
 * agent runs, track progress, and consume results.
 *
 * Usage:
 *   const { runAgent, runFleet, status, results, error } = useAgentRunner();
 *   await runFleet("audit");
 *   await runAgent("safety.safety-gate", { diff: "..." });
 */

import { useCallback, useRef, useState } from "react";
import type { AgentResultV6, FleetName } from "./BaseAgent";

// ── Types ──────────────────────────────────────────────────────────

export type AgentRunStatus = "idle" | "running" | "success" | "error";

export interface AgentRunState {
  /** Current status */
  status: AgentRunStatus;
  /** Active run ID (null when idle) */
  runId: string | null;
  /** Accumulated results keyed by agent ID */
  results: Map<string, AgentResultV6>;
  /** Error message if status === "error" */
  error: string | null;
  /** Total cost USD spent in current run */
  totalCostUsd: number;
  /** Total latency ms */
  totalLatencyMs: number;
  /** Running agents (for progress display) */
  activeAgents: string[];
}

export interface UseAgentRunnerReturn {
  /** Current state */
  state: AgentRunState;
  /** Run a single agent via /api/agents/run */
  runAgent: (agentId: string, input?: unknown, budget?: number) => Promise<AgentRunState>;
  /** Run an entire fleet */
  runFleet: (fleet: FleetName, budget?: number) => Promise<AgentRunState>;
  /** List available agents */
  listAgents: () => Promise<AgentRegistryEntry[]>;
  /** Cancel running operation */
  cancel: () => void;
  /** Reset state to idle */
  reset: () => void;
}

export interface AgentRegistryEntry {
  id: string;
  name: string;
  fleet: FleetName;
  role: string;
  description: string;
}

// ── Initial state ──────────────────────────────────────────────────

const INITIAL_STATE: AgentRunState = {
  status: "idle",
  runId: null,
  results: new Map(),
  error: null,
  totalCostUsd: 0,
  totalLatencyMs: 0,
  activeAgents: [],
};

// ── Hook ───────────────────────────────────────────────────────────

export function useAgentRunner(): UseAgentRunnerReturn {
  const [state, setState] = useState<AgentRunState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const runAgent = useCallback(async (
    agentId: string,
    input?: unknown,
    budget = 1.0,
  ): Promise<AgentRunState> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const runId = crypto.randomUUID();
    const startState: AgentRunState = {
      status: "running",
      runId,
      results: new Map(),
      error: null,
      totalCostUsd: 0,
      totalLatencyMs: 0,
      activeAgents: [agentId],
    };
    setState(startState);

    try {
      const startMs = Date.now();
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, input, budget }),
        signal: controller.signal,
      });

      const data = await res.json() as {
        ok: boolean;
        error?: string;
        runId?: string;
        status?: string;
        agents?: string[];
      };

      const latencyMs = Date.now() - startMs;

      if (!data.ok) {
        const errorState: AgentRunState = {
          ...startState,
          status: "error",
          error: data.error ?? "Agent run failed",
          activeAgents: [],
        };
        setState(errorState);
        return errorState;
      }

      const result: AgentResultV6 = {
        success: true,
        costUsd: 0,
        latencyMs,
        evidence: [`agentId=${agentId}`, `runId=${data.runId}`],
      };

      const successState: AgentRunState = {
        status: "success",
        runId: data.runId ?? runId,
        results: new Map([[agentId, result]]),
        error: null,
        totalCostUsd: result.costUsd,
        totalLatencyMs: latencyMs,
        activeAgents: [],
      };
      setState(successState);
      return successState;
    } catch (err) {
      if ((err as Error).name === "AbortError") return state;
      const errorState: AgentRunState = {
        ...startState,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        activeAgents: [],
      };
      setState(errorState);
      return errorState;
    }
  }, [state]);

  const runFleet = useCallback(async (
    fleet: FleetName,
    budget = 1.0,
  ): Promise<AgentRunState> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const runId = crypto.randomUUID();
    const startState: AgentRunState = {
      status: "running",
      runId,
      results: new Map(),
      error: null,
      totalCostUsd: 0,
      totalLatencyMs: 0,
      activeAgents: [`fleet:${fleet}`],
    };
    setState(startState);

    try {
      const startMs = Date.now();
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fleet, budget }),
        signal: controller.signal,
      });

      const data = await res.json() as {
        ok: boolean;
        error?: string;
        runId?: string;
        agents?: string[];
        budget?: number;
      };

      const latencyMs = Date.now() - startMs;

      if (!data.ok) {
        const errorState: AgentRunState = {
          ...startState,
          status: "error",
          error: data.error ?? "Fleet run failed",
          activeAgents: [],
        };
        setState(errorState);
        return errorState;
      }

      const results = new Map<string, AgentResultV6>();
      for (const agentId of data.agents ?? []) {
        results.set(agentId, {
          success: true,
          costUsd: 0,
          latencyMs,
          evidence: [`fleet=${fleet}`, `runId=${data.runId}`],
        });
      }

      const successState: AgentRunState = {
        status: "success",
        runId: data.runId ?? runId,
        results,
        error: null,
        totalCostUsd: 0,
        totalLatencyMs: latencyMs,
        activeAgents: [],
      };
      setState(successState);
      return successState;
    } catch (err) {
      if ((err as Error).name === "AbortError") return state;
      const errorState: AgentRunState = {
        ...startState,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
        activeAgents: [],
      };
      setState(errorState);
      return errorState;
    }
  }, [state]);

  const listAgents = useCallback(async (): Promise<AgentRegistryEntry[]> => {
    const res = await fetch("/api/agents/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listAgents: true }),
    });
    const data = await res.json() as { ok: boolean; agents?: AgentRegistryEntry[] };
    return data.agents ?? [];
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((prev) => ({
      ...prev,
      status: prev.status === "running" ? "idle" : prev.status,
      activeAgents: [],
    }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  return { state, runAgent, runFleet, listAgents, cancel, reset };
}
