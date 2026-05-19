/**
 * Benchmark Suite Runner
 *
 * Imports and runs all benchmark modules, then prints a unified summary table.
 * Run with: npm run bench
 */

import { printTable, type BenchResult } from "./bench.js";
import { runHNSWBenchmarks } from "./hnsw.bench.js";
import { runEvidenceMemoryBenchmarks } from "./evidence-memory.bench.js";
import { runPIIBenchmarks } from "./pii.bench.js";
import { runGOAPBenchmarks } from "./goap.bench.js";

async function main(): Promise<void> {
  console.log("\nDesygn AI — Performance Benchmark Suite");
  console.log("=".repeat(70));
  console.log(`Platform : ${process.platform}  Node ${process.version}`);
  console.log(`Date     : ${new Date().toISOString()}`);
  console.log("");

  const allResults: BenchResult[] = [];

  // ── HNSW Vector Search ────────────────────────────────────────
  console.log("Running HNSW Vector Search benchmarks...");
  try {
    const hnswResults = runHNSWBenchmarks();
    allResults.push(...hnswResults);
  } catch (err) {
    console.error("HNSW benchmark suite error:", err);
  }

  // ── Evidence Memory ───────────────────────────────────────────
  console.log("Running Evidence Memory benchmarks...");
  try {
    const memResults = await runEvidenceMemoryBenchmarks();
    allResults.push(...memResults);
  } catch (err) {
    console.error("Evidence Memory benchmark suite error:", err);
  }

  // ── PII Detection ─────────────────────────────────────────────
  console.log("Running PII Detection benchmarks...");
  try {
    const piiResults = runPIIBenchmarks();
    allResults.push(...piiResults);
  } catch (err) {
    console.error("PII benchmark suite error:", err);
  }

  // ── GOAP Planner ──────────────────────────────────────────────
  console.log("Running GOAP Planner benchmarks...");
  try {
    const goapResults = runGOAPBenchmarks();
    allResults.push(...goapResults);
  } catch (err) {
    console.error("GOAP benchmark suite error:", err);
  }

  // ── Summary Table ─────────────────────────────────────────────
  console.log("\n");
  printTable(allResults);
  console.log(`\nTotal benchmarks: ${allResults.length}`);
}

main().catch((err) => {
  console.error("Benchmark runner failed:", err);
  process.exit(1);
});
