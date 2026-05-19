# Performance Benchmarks

Simple timing-based benchmarks for the compute-intensive modules in Desygn AI.
No external benchmark framework — uses `performance.now()` directly so results
are easy to reproduce and diff in CI.

## Available benchmarks

| File | Module | What is measured |
|---|---|---|
| `hnsw.bench.ts` | `hnswVectorSearch.ts` | Insert 1000 vectors (dim 64), search top-10 in 1000-vec index, insert+search combined |
| `evidence-memory.bench.ts` | `evidenceMemory.ts` | Store 100 records, search by query, export/import snapshot, sigmoid decay |
| `pii.bench.ts` | `piiDetection.ts` | Short-text scan, long-text scan (5000 chars), Vietnamese CCCD scan, redact |
| `goap.bench.ts` | `goapPlanner.ts` | Plan with 5 actions/3 goals, design-agent planner (7 actions), 20 actions/5 goals stress test |

## How to run

```bash
npm run bench
```

This runs `npx tsx benchmarks/index.ts` and prints a summary table such as:

```
┌──────────────────────────────────────┬───────────┬────────────┬──────────┬──────────┐
│ Benchmark                            │   ops/sec │   avg (ms) │      min │      max │
├──────────────────────────────────────┼───────────┼────────────┼──────────┼──────────┤
│ HNSW: insert 1000 vectors (dim 64)   │        52 │    19.2300 │  18.1000 │  22.4000 │
│ HNSW: search top-10 in 1000-vec idx │      4201 │     0.2380 │   0.2100 │   0.3100 │
│ ...                                  │           │            │          │          │
└──────────────────────────────────────┴───────────┴────────────┴──────────┴──────────┘
```

Each benchmark failure is caught and logged individually — the runner continues
to completion even if one suite errors.

## How to add a new benchmark

1. Create `benchmarks/<module-name>.bench.ts`.
2. Import the module under test using its path relative to the project root
   (e.g. `../web/src/lib/myModule.js`).
3. Use `bench()` for sync work or `benchAsync()` for async work, both exported
   from `./bench.js`.
4. Export a `run<Name>Benchmarks()` function that returns `BenchResult[]`
   (or `Promise<BenchResult[]>` for async).

```typescript
// benchmarks/my-module.bench.ts
import { myFunction } from "../web/src/lib/myModule.js";
import { bench, type BenchResult } from "./bench.js";

export function runMyModuleBenchmarks(): BenchResult[] {
  const results: BenchResult[] = [];

  try {
    results.push(
      bench("MyModule: describe what is measured", () => {
        myFunction(/* args */);
      }, 1000 /* iterations */),
    );
  } catch (err) {
    console.error("MyModule benchmark failed:", err);
  }

  return results;
}
```

5. Import and call it in `benchmarks/index.ts`:

```typescript
import { runMyModuleBenchmarks } from "./my-module.bench.js";
// ...
const myResults = runMyModuleBenchmarks();
allResults.push(...myResults);
```

## Iteration guidance

| Operation cost | Suggested iterations |
|---|---|
| < 0.1 ms (fast regex, lookups) | 1000 |
| 0.1 – 5 ms (search, planning) | 100 – 300 |
| 5 – 50 ms (build index, snapshot import) | 10 – 50 |
| > 50 ms (full HNSW build) | 5 – 10 |

Keep the warmup at 10 iterations (sync) or 5 (async) so JIT optimization
does not skew the first measured samples.
