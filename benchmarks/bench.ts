/**
 * Benchmark Runner — Simple timing-based performance measurement.
 * No external dependencies. Uses performance.now() for high-resolution timing.
 */

export interface BenchResult {
  name: string;
  ops: number;    // operations per second
  avgMs: number;  // average ms per operation
  minMs: number;
  maxMs: number;
  samples: number;
}

/**
 * Synchronous benchmark runner.
 * Performs a warmup pass then measures `iterations` timed runs.
 */
export function bench(name: string, fn: () => void, iterations = 1000): BenchResult {
  // Warmup: let JIT settle
  for (let i = 0; i < 10; i++) fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b) / times.length;
  return {
    name,
    ops: Math.round(1000 / avg),
    avgMs: Number(avg.toFixed(4)),
    minMs: Number(Math.min(...times).toFixed(4)),
    maxMs: Number(Math.max(...times).toFixed(4)),
    samples: iterations,
  };
}

/**
 * Async benchmark runner.
 * Performs a warmup pass then measures `iterations` timed async runs.
 */
export async function benchAsync(
  name: string,
  fn: () => Promise<void>,
  iterations = 100,
): Promise<BenchResult> {
  // Warmup
  for (let i = 0; i < 5; i++) await fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b) / times.length;
  return {
    name,
    ops: Math.round(1000 / avg),
    avgMs: Number(avg.toFixed(4)),
    minMs: Number(Math.min(...times).toFixed(4)),
    maxMs: Number(Math.max(...times).toFixed(4)),
    samples: iterations,
  };
}

/**
 * Print an array of BenchResults as a formatted table to stdout.
 */
export function printTable(results: BenchResult[]): void {
  const COL = { name: 36, ops: 9, avg: 10, min: 8, max: 8 };

  const pad = (s: string | number, len: number, right = false): string => {
    const str = String(s);
    return right ? str.padStart(len) : str.padEnd(len);
  };

  const sep = (char = "─"): string =>
    `├${"─".repeat(COL.name + 2)}┼${"─".repeat(COL.ops + 2)}┼${"─".repeat(COL.avg + 2)}┼${"─".repeat(COL.min + 2)}┼${"─".repeat(COL.max + 2)}┤`;

  const topBorder =
    `┌${"─".repeat(COL.name + 2)}┬${"─".repeat(COL.ops + 2)}┬${"─".repeat(COL.avg + 2)}┬${"─".repeat(COL.min + 2)}┬${"─".repeat(COL.max + 2)}┐`;
  const botBorder =
    `└${"─".repeat(COL.name + 2)}┴${"─".repeat(COL.ops + 2)}┴${"─".repeat(COL.avg + 2)}┴${"─".repeat(COL.min + 2)}┴${"─".repeat(COL.max + 2)}┘`;

  const row = (name: string, ops: string, avg: string, min: string, max: string): string =>
    `│ ${pad(name, COL.name)} │ ${pad(ops, COL.ops, true)} │ ${pad(avg, COL.avg, true)} │ ${pad(min, COL.min, true)} │ ${pad(max, COL.max, true)} │`;

  console.log(topBorder);
  console.log(row("Benchmark", "ops/sec", "avg (ms)", "min", "max"));
  console.log(sep());

  for (const r of results) {
    console.log(row(r.name, String(r.ops), String(r.avgMs), String(r.minMs), String(r.maxMs)));
  }

  console.log(botBorder);
}
