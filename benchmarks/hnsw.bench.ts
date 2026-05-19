/**
 * HNSW Vector Search Benchmarks
 *
 * Covers:
 *   • Inserting 1000 vectors (dim 64) into a fresh index
 *   • Searching top-10 nearest neighbors in a pre-built 1000-vector index
 *   • Combined insert + search per operation
 */

import { HNSWIndex, createHNSWIndex } from "../web/src/lib/hnswVectorSearch.js";
import { bench, type BenchResult } from "./bench.js";

const DIM = 64;
const COUNT = 1000;

/** Generate a random Float32Array of the given dimension */
function randomVec(dim: number): number[] {
  const v: number[] = [];
  for (let i = 0; i < dim; i++) v.push(Math.random() * 2 - 1);
  return v;
}

/** Build and return a pre-populated index with `count` vectors */
function buildIndex(count: number, dim: number): HNSWIndex {
  const idx = createHNSWIndex({ dimensions: dim, maxElements: count + 10, M: 16, efConstruction: 100, efSearch: 50 });
  for (let i = 0; i < count; i++) {
    idx.insert(`v${i}`, randomVec(dim));
  }
  return idx;
}

export function runHNSWBenchmarks(): BenchResult[] {
  const results: BenchResult[] = [];

  // Pre-generate vectors to avoid measuring random generation overhead
  const vectors = Array.from({ length: COUNT }, () => randomVec(DIM));
  const queryVec = randomVec(DIM);

  // ── Benchmark 1: Insert 1000 vectors ──────────────────────────
  try {
    results.push(
      bench(
        "HNSW: insert 1000 vectors (dim 64)",
        () => {
          const idx = new HNSWIndex({
            dimensions: DIM,
            maxElements: COUNT + 10,
            M: 16,
            efConstruction: 100,
            efSearch: 50,
          });
          for (let i = 0; i < COUNT; i++) {
            idx.insert(`v${i}`, vectors[i]);
          }
        },
        10, // inserting 1000 vecs is slow — keep iteration count low
      ),
    );
  } catch (err) {
    console.error("HNSW insert benchmark failed:", err);
  }

  // ── Benchmark 2: Search top-10 in 1000-vector index ──────────
  try {
    const searchIndex = buildIndex(COUNT, DIM);
    results.push(
      bench(
        "HNSW: search top-10 in 1000-vec index",
        () => {
          searchIndex.search(queryVec, 10);
        },
        1000,
      ),
    );
  } catch (err) {
    console.error("HNSW search benchmark failed:", err);
  }

  // ── Benchmark 3: Insert single + search combined ──────────────
  try {
    // Pre-build a base index with 500 vectors; each iteration inserts 1 new + searches
    const baseIndex = buildIndex(500, DIM);
    let insertCounter = 500;
    results.push(
      bench(
        "HNSW: insert 1 vec + search top-10",
        () => {
          baseIndex.insert(`v${insertCounter++}`, randomVec(DIM));
          baseIndex.search(queryVec, 10);
        },
        200,
      ),
    );
  } catch (err) {
    console.error("HNSW combined benchmark failed:", err);
  }

  return results;
}
