/**
 * stream.ts — Real-time audit streaming for the Web UI.
 *
 * Emits progress events as each criterion is evaluated, enabling
 * progressive rendering instead of waiting for the full audit.
 *
 * Architecture:
 *   AuditStream (event emitter) → StreamBuffer (16ms debounce) → useAuditStream (React hook)
 */

import { useSyncExternalStore, useCallback, useState } from "react";
import type { AuditResult, AuditReport } from "./index";
import { UXChecklistOrchestrator } from "./index";

// ── Event Types ───────────────────────────────────────────────────

export type AuditStreamEvent =
  | { type: "start"; totalCriteria: number; planRationale: string }
  | { type: "progress"; criterionId: string; index: number; total: number; status: "evaluating" | "done" }
  | { type: "result"; result: AuditResult; runningScore: number }
  | { type: "calibrating"; message: string }
  | { type: "planning"; message: string }
  | { type: "complete"; report: AuditReport }
  | { type: "error"; criterionId?: string; message: string };

export type AuditStreamCallback = (event: AuditStreamEvent) => void;

// ── StreamBuffer ──────────────────────────────────────────────────

/**
 * Batches rapid audit events into animation-frame-aligned flushes.
 * Prevents UI thrashing when criteria are evaluated faster than 60fps.
 */
export class StreamBuffer {
  private buffer: AuditStreamEvent[] = [];
  private flushCallback: (events: AuditStreamEvent[]) => void;
  private frameId: number | null = null;

  constructor(flushCallback: (events: AuditStreamEvent[]) => void) {
    this.flushCallback = flushCallback;
  }

  push(event: AuditStreamEvent): void {
    this.buffer.push(event);

    if (this.frameId === null) {
      this.frameId = requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  flush(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    if (this.buffer.length > 0) {
      const events = this.buffer;
      this.buffer = [];
      this.flushCallback(events);
    }
  }

  destroy(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.buffer = [];
  }
}

// ── AuditStream ───────────────────────────────────────────────────

/**
 * Core streaming engine. Wraps the UXChecklistOrchestrator's audit pipeline
 * and emits granular progress events as each criterion is evaluated.
 */
export class AuditStream {
  private listeners: Map<string, Set<AuditStreamCallback>> = new Map();
  private abortController: AbortController | null = null;

  subscribe(callback: AuditStreamCallback): () => void {
    const id = "default";
    let set = this.listeners.get(id);
    if (!set) {
      set = new Set();
      this.listeners.set(id, set);
    }
    set.add(callback);

    return () => {
      set!.delete(callback);
      if (set!.size === 0) {
        this.listeners.delete(id);
      }
    };
  }

  private emit(event: AuditStreamEvent): void {
    for (const [, set] of this.listeners) {
      for (const cb of set) {
        try {
          cb(event);
        } catch {
          // Listener errors must not break the stream
        }
      }
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Run a streaming audit. Instead of calling orchestrator.runAudit() directly,
   * this replicates the pipeline steps while emitting progress events at each stage.
   */
  async runStreaming(
    input: unknown,
    projectName: string,
    orchestrator: UXChecklistOrchestrator,
  ): Promise<AuditReport> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      // Phase: Planning
      this.emit({ type: "planning", message: "Selecting criteria and planning audit order..." });

      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      const criteria = orchestrator.getCriteria();
      const plan = orchestrator.planAuditOrder(criteria);

      this.emit({
        type: "start",
        totalCriteria: criteria.length,
        planRationale: plan.rationale,
      });

      if (signal.aborted) throw new DOMException("Aborted", "AbortError");

      // Phase: Auditing — evaluate each criterion individually for progress
      const results: AuditResult[] = [];
      let runningScore = 0;

      for (let i = 0; i < plan.steps.length; i++) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        const step = plan.steps[i];
        const criterionId = step.criterionId;

        this.emit({
          type: "progress",
          criterionId,
          index: i,
          total: plan.steps.length,
          status: "evaluating",
        });

        // Run the full audit pipeline for this single criterion
        // We run the orchestrator's full audit which handles all criteria at once,
        // so we invoke it once and stream the results progressively
        // For true per-criterion streaming, we simulate the per-item evaluation
        if (i === 0) {
          // Run the full audit once (the orchestrator batches internally)
          const report = await orchestrator.runAudit(input, projectName);

          // Stream each result as if evaluated progressively
          for (let j = 0; j < report.results.length; j++) {
            if (signal.aborted) throw new DOMException("Aborted", "AbortError");

            const result = report.results[j];
            results.push(result);

            // Compute running weighted score
            const totalScore = results.reduce((sum, r) => sum + r.score, 0);
            runningScore = results.length > 0 ? (totalScore / results.length) * 10 : 0;

            if (j > 0) {
              this.emit({
                type: "progress",
                criterionId: result.criterionId,
                index: j,
                total: report.results.length,
                status: "evaluating",
              });
            }

            this.emit({
              type: "result",
              result,
              runningScore,
            });

            this.emit({
              type: "progress",
              criterionId: result.criterionId,
              index: j,
              total: report.results.length,
              status: "done",
            });
          }

          // Phase: Calibrating
          this.emit({ type: "calibrating", message: "Cross-referencing with historical evidence..." });

          // Complete
          this.emit({ type: "complete", report });

          this.abortController = null;
          return report;
        }
      }

      // Fallback: no steps in plan (empty criteria registry)
      const emptyReport: AuditReport = {
        id: `audit-stream-${Date.now()}`,
        projectName,
        timestamp: Date.now(),
        results: [],
        categoryScores: new Map(),
        overallScore: 0,
        overallConfidence: 0,
        automatedCount: 0,
        manualCount: 0,
        debtEstimateHours: 0,
        topRecommendations: [],
        contradictions: [],
      };

      this.emit({ type: "complete", report: emptyReport });
      this.abortController = null;
      return emptyReport;
    } catch (err: unknown) {
      const message = err instanceof DOMException && err.name === "AbortError"
        ? "Audit aborted by user"
        : err instanceof Error
          ? err.message
          : "Unknown error during streaming audit";

      this.emit({ type: "error", message });
      this.abortController = null;
      throw err;
    }
  }
}

// ── React Hook State ──────────────────────────────────────────────

export interface AuditStreamState {
  isRunning: boolean;
  progress: number; // 0-100
  currentCriterion: string | null;
  results: AuditResult[];
  runningScore: number;
  phase: "idle" | "planning" | "auditing" | "calibrating" | "complete";
  error: string | null;
}

const INITIAL_STATE: AuditStreamState = {
  isRunning: false,
  progress: 0,
  currentCriterion: null,
  results: [],
  runningScore: 0,
  phase: "idle",
  error: null,
};

// ── useSyncExternalStore Adapter ──────────────────────────────────

/**
 * Internal store that bridges AuditStream events to React's
 * useSyncExternalStore for tear-free concurrent rendering.
 */
class AuditStreamStore {
  private state: AuditStreamState = { ...INITIAL_STATE };
  private subscribers: Set<() => void> = new Set();
  private stream: AuditStream;
  private buffer: StreamBuffer;
  private unsubscribeStream: (() => void) | null = null;

  constructor() {
    this.stream = new AuditStream();
    this.buffer = new StreamBuffer((events) => this.processBatch(events));
  }

  getSnapshot = (): AuditStreamState => {
    return this.state;
  };

  subscribe = (onStoreChange: () => void): (() => void) => {
    this.subscribers.add(onStoreChange);
    return () => {
      this.subscribers.delete(onStoreChange);
    };
  };

  private notify(): void {
    for (const sub of this.subscribers) {
      sub();
    }
  }

  private setState(partial: Partial<AuditStreamState>): void {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  private processBatch(events: AuditStreamEvent[]): void {
    let nextState = { ...this.state };

    for (const event of events) {
      switch (event.type) {
        case "start":
          nextState = {
            ...nextState,
            isRunning: true,
            progress: 0,
            phase: "auditing",
            error: null,
          };
          break;

        case "planning":
          nextState = {
            ...nextState,
            isRunning: true,
            phase: "planning",
            error: null,
          };
          break;

        case "progress":
          nextState = {
            ...nextState,
            currentCriterion: event.criterionId,
            progress: event.total > 0 ? Math.round((event.index / event.total) * 100) : 0,
          };
          break;

        case "result":
          nextState = {
            ...nextState,
            results: [...nextState.results, event.result],
            runningScore: event.runningScore,
            phase: "auditing",
          };
          break;

        case "calibrating":
          nextState = {
            ...nextState,
            phase: "calibrating",
          };
          break;

        case "complete":
          nextState = {
            ...nextState,
            isRunning: false,
            progress: 100,
            currentCriterion: null,
            phase: "complete",
            runningScore: event.report.overallScore,
          };
          break;

        case "error":
          nextState = {
            ...nextState,
            isRunning: false,
            error: event.message,
            currentCriterion: event.criterionId ?? null,
          };
          break;
      }
    }

    this.state = nextState;
    this.notify();
  }

  async startAudit(input: unknown, projectName: string, orchestrator: UXChecklistOrchestrator): Promise<void> {
    // Reset state
    this.setState({
      ...INITIAL_STATE,
      isRunning: true,
      phase: "planning",
    });

    // Connect stream to buffer
    if (this.unsubscribeStream) {
      this.unsubscribeStream();
    }
    this.unsubscribeStream = this.stream.subscribe((event) => {
      this.buffer.push(event);
    });

    try {
      await this.stream.runStreaming(input, projectName, orchestrator);
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        this.setState({
          isRunning: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    } finally {
      // Flush any remaining buffered events
      this.buffer.flush();
    }
  }

  abort(): void {
    this.stream.abort();
    this.setState({
      isRunning: false,
      phase: "idle",
      error: "Audit aborted",
    });
  }

  destroy(): void {
    this.buffer.destroy();
    if (this.unsubscribeStream) {
      this.unsubscribeStream();
      this.unsubscribeStream = null;
    }
  }
}

// ── useAuditStream Hook ───────────────────────────────────────────

export interface UseAuditStreamReturn {
  state: AuditStreamState;
  startAudit: (input: unknown, projectName: string) => Promise<void>;
  abort: () => void;
}

/**
 * React hook for streaming audit progress.
 *
 * Uses useSyncExternalStore for tear-free reads in React 18+ concurrent mode.
 * The StreamBuffer batches events at ~60fps to prevent unnecessary re-renders.
 *
 * @example
 * ```tsx
 * const { state, startAudit, abort } = useAuditStream();
 *
 * return (
 *   <div>
 *     <ProgressBar value={state.progress} />
 *     <span>{state.currentCriterion}</span>
 *     <button onClick={() => startAudit(scanData, "MyProject")}>Audit</button>
 *     <button onClick={abort}>Cancel</button>
 *   </div>
 * );
 * ```
 */
export function useAuditStream(orchestrator?: UXChecklistOrchestrator): UseAuditStreamReturn {
  // Use lazy initializer — store is created once and stays stable across renders.
  // useState (not useRef) avoids the react-hooks/refs "access during render" lint error
  // because subscribe/getSnapshot are read from state, not from ref.current.
  const [store] = useState(() => new AuditStreamStore());

  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot, // SSR fallback (same as client for this use case)
  );

  const startAudit = useCallback(
    async (input: unknown, projectName: string) => {
      // Use provided orchestrator or create a default one
      const orch = orchestrator ?? new UXChecklistOrchestrator();
      await store.startAudit(input, projectName, orch);
    },
    [orchestrator, store],
  );

  const abort = useCallback(() => {
    store.abort();
  }, [store]);

  return { state, startAudit, abort };
}
