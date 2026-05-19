/**
 * Evidence Memory Benchmarks
 *
 * Covers:
 *   • Storing 100 evidence records (async, measured per-record)
 *   • Searching by query in a 100-record store
 *   • Export/import snapshot with 100 records
 *   • Sigmoid decay calculation on 100 records (decayUnvalidated)
 */

import { EvidenceMemoryEngine, type EvidenceSource } from "../web/src/lib/evidenceMemory.js";
import { benchAsync, type BenchResult } from "./bench.js";

const RECORD_COUNT = 100;

const SAMPLE_CONTENTS = [
  "Primary button uses brand-blue color #0057FF with 4px border radius",
  "Typography scale: H1 48px, H2 36px, H3 24px, body 16px line-height 1.5",
  "Card component has 8px padding and drop-shadow elevation-2",
  "Navigation bar height is 64px on desktop and 56px on mobile",
  "Form inputs have 40px height with 2px border and focus ring",
  "Icon size small: 16px, medium: 24px, large: 32px",
  "Spacing scale uses 4px base unit with multipliers 1,2,3,4,6,8,12,16",
  "Modal overlay uses rgba(0,0,0,0.5) with blur-sm backdrop filter",
  "Toast notification appears at top-right corner with 4px corner radius",
  "Data table row height is 48px with hover state background #F5F5F5",
];

const SOURCES: EvidenceSource[] = ["design-file", "user-feedback", "ai-inference", "pattern-match"];

function makeRecord(i: number) {
  return {
    content: SAMPLE_CONTENTS[i % SAMPLE_CONTENTS.length] + ` (record ${i})`,
    source: SOURCES[i % SOURCES.length],
    confidence: 0.5 + (i % 5) * 0.1,
    validated: false,
    contradictions: [],
    tags: [`component-${i % 10}`, `layer-${i % 3}`],
    metadata: { index: i },
  };
}

/** Create and configure a fresh engine */
function makeEngine(): EvidenceMemoryEngine {
  const engine = new EvidenceMemoryEngine();
  engine.configure({
    enableVectorSearch: true,
    vectorDimensions: 64,
    maxRecords: 1000,
    decayFunction: "sigmoid",
  });
  return engine;
}

/** Build an engine already populated with `count` records */
async function buildPopulatedEngine(count: number): Promise<EvidenceMemoryEngine> {
  const engine = makeEngine();
  for (let i = 0; i < count; i++) {
    await engine.storeEvidence(makeRecord(i));
  }
  return engine;
}

export async function runEvidenceMemoryBenchmarks(): Promise<BenchResult[]> {
  const results: BenchResult[] = [];

  // ── Benchmark 1: Store 100 evidence records ───────────────────
  try {
    results.push(
      await benchAsync(
        "EvidenceMemory: store 100 records",
        async () => {
          const engine = makeEngine();
          for (let i = 0; i < RECORD_COUNT; i++) {
            await engine.storeEvidence(makeRecord(i));
          }
        },
        10,
      ),
    );
  } catch (err) {
    console.error("EvidenceMemory store benchmark failed:", err);
  }

  // ── Benchmark 2: Search by query in 100-record store ──────────
  try {
    const searchEngine = await buildPopulatedEngine(RECORD_COUNT);
    results.push(
      await benchAsync(
        "EvidenceMemory: search in 100-record store",
        async () => {
          await searchEngine.recallEvidence("button color border radius component", { limit: 10 });
        },
        100,
      ),
    );
  } catch (err) {
    console.error("EvidenceMemory search benchmark failed:", err);
  }

  // ── Benchmark 3: Export + Import snapshot (100 records) ───────
  try {
    const snapshotEngine = await buildPopulatedEngine(RECORD_COUNT);
    const snapshot = await snapshotEngine.exportSnapshot();

    results.push(
      await benchAsync(
        "EvidenceMemory: export snapshot (100 records)",
        async () => {
          await snapshotEngine.exportSnapshot();
        },
        100,
      ),
    );

    results.push(
      await benchAsync(
        "EvidenceMemory: import snapshot (100 records)",
        async () => {
          const engine = makeEngine();
          await engine.importSnapshot(snapshot);
        },
        20,
      ),
    );
  } catch (err) {
    console.error("EvidenceMemory snapshot benchmark failed:", err);
  }

  // ── Benchmark 4: Sigmoid decay on 100 records ─────────────────
  try {
    // Build a fresh engine for each decay call to avoid records decaying below threshold
    const decayEngine = await buildPopulatedEngine(RECORD_COUNT);
    results.push(
      await benchAsync(
        "EvidenceMemory: sigmoid decay (100 records)",
        async () => {
          await decayEngine.decayUnvalidated();
        },
        50,
      ),
    );
  } catch (err) {
    console.error("EvidenceMemory decay benchmark failed:", err);
  }

  return results;
}
