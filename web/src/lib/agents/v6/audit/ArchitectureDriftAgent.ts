/**
 * ArchitectureDriftAgent — detects architectural drift in the codebase.
 *
 * Checks:
 *   1. Circular dependencies (A→B→C→A)
 *   2. Naming convention violations (file/export naming patterns)
 *   3. Barrel file completeness (index.ts exports vs actual files)
 *   4. Layer boundary violations (UI importing from server, etc.)
 *   5. Orphan files (source files never imported anywhere)
 *
 * Deterministic v0 — no LLM. Uses import graph + convention rules.
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";
import type { FileEntry } from "../map/RepoMapAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ArchDriftInput {
  /** Repo file entries from RepoMapAgent */
  files: FileEntry[];
  /** Layer boundary rules: directory → allowed import directories */
  layerRules?: Record<string, string[]>;
  /** Naming convention: regex pattern per directory */
  namingRules?: NamingRule[];
  /** Barrel directories to check (dirs that should have index.ts) */
  barrelDirs?: string[];
}

export interface NamingRule {
  /** Glob-like directory prefix to match */
  dirPrefix: string;
  /** Regex pattern that filenames must match */
  pattern: string;
  /** Human-readable description */
  description: string;
}

export interface DriftViolation {
  /** Violation type */
  type: "circular-dep" | "naming" | "barrel-gap" | "layer-breach" | "orphan";
  /** Severity */
  severity: "critical" | "warning" | "info";
  /** Which file(s) are involved */
  files: string[];
  /** Description of the violation */
  message: string;
  /** Suggested fix */
  suggestion: string;
}

export interface ArchDriftOutput {
  /** All violations found */
  violations: DriftViolation[];
  /** Health score 0-100 (100 = no drift) */
  healthScore: number;
  /** Stats */
  stats: {
    filesAnalyzed: number;
    circularDeps: number;
    namingViolations: number;
    barrelGaps: number;
    layerBreaches: number;
    orphanFiles: number;
  };
  /** Import graph adjacency (file → imported files) */
  importGraph: Record<string, string[]>;
}

// Default layer rules for the project
const DEFAULT_LAYER_RULES: Record<string, string[]> = {
  "ui/": ["ui/", "shared/", "src/lib/"],
  "src/lib/": ["src/lib/", "shared/"],
  "api/": ["api/", "src/lib/", "shared/"],
  "shared/": ["shared/"],
};

// Default naming rules
const DEFAULT_NAMING_RULES: NamingRule[] = [
  {
    dirPrefix: "src/components",
    pattern: "^[A-Z][a-zA-Z0-9]+\\.(tsx|module\\.scss|stories\\.tsx)$",
    description: "Components must be PascalCase",
  },
  {
    dirPrefix: "src/lib/agents",
    pattern: "^[A-Z][a-zA-Z0-9]+Agent\\.(ts|test\\.ts)$|^index\\.ts$|^__tests__",
    description: "Agents must be PascalCase ending with 'Agent'",
  },
  {
    dirPrefix: "src/lib",
    pattern: "^[a-z][a-zA-Z0-9]*\\.ts$|^index\\.ts$|^__tests__",
    description: "Library files must be camelCase",
  },
];

export class ArchitectureDriftAgent extends BaseAgentV6<ArchDriftInput, ArchDriftOutput> {
  readonly id = "audit.architecture-drift";
  readonly name = "Architecture Drift";
  readonly fleet: FleetName = "audit";
  readonly role = "analyzer" as const;
  readonly description = "Detects circular deps, naming violations, barrel gaps, and layer breaches";

  protected async run(
    input: ArchDriftInput,
    ctx: AgentContextV6,
  ): Promise<{ output: ArchDriftOutput; evidence?: string[] }> {
    const {
      files,
      layerRules = DEFAULT_LAYER_RULES,
      namingRules = DEFAULT_NAMING_RULES,
      barrelDirs,
    } = input;

    const violations: DriftViolation[] = [];

    // 1. Build import graph
    const importGraph = buildImportGraph(files);

    // 2. Detect circular dependencies
    const cycles = detectCycles(importGraph);
    for (const cycle of cycles) {
      violations.push({
        type: "circular-dep",
        severity: "critical",
        files: cycle,
        message: `Circular dependency: ${cycle.join(" → ")} → ${cycle[0]}`,
        suggestion: "Break the cycle by extracting shared types into a common module",
      });
    }

    // 3. Check naming conventions
    for (const file of files) {
      if (file.isTest || file.isStory) continue;
      for (const rule of namingRules) {
        if (file.path.includes(rule.dirPrefix)) {
          const fileName = basename(file.path);
          const re = new RegExp(rule.pattern);
          if (!re.test(fileName)) {
            violations.push({
              type: "naming",
              severity: "warning",
              files: [file.path],
              message: `"${fileName}" violates naming convention: ${rule.description}`,
              suggestion: `Rename to match pattern: ${rule.pattern}`,
            });
          }
          break; // First matching rule wins
        }
      }
    }

    // 4. Check barrel files
    if (barrelDirs) {
      for (const dir of barrelDirs) {
        const dirFiles = files.filter(
          (f) => f.path.startsWith(dir) && !f.path.includes("__tests__") && !f.isTest && !f.isStory,
        );
        const barrelFile = dirFiles.find((f) => f.path === `${dir}/index.ts` || f.path === `${dir}index.ts`);

        if (!barrelFile) {
          violations.push({
            type: "barrel-gap",
            severity: "warning",
            files: [dir],
            message: `Missing barrel file (index.ts) in ${dir}`,
            suggestion: `Create ${dir}/index.ts to re-export all public modules`,
          });
          continue;
        }

        // Check for files in the dir that aren't exported through the barrel
        const exportedNames = new Set(barrelFile.exports);
        const nonBarrelFiles = dirFiles.filter(
          (f) => f !== barrelFile && f.exports.length > 0,
        );

        for (const f of nonBarrelFiles) {
          const unexported = f.exports.filter((e) => !exportedNames.has(e));
          if (unexported.length > 0 && unexported.length === f.exports.length) {
            violations.push({
              type: "barrel-gap",
              severity: "info",
              files: [f.path, barrelFile.path],
              message: `${basename(f.path)} exports [${unexported.join(", ")}] not re-exported from barrel`,
              suggestion: `Add re-exports to ${barrelFile.path}`,
            });
          }
        }
      }
    }

    // 5. Check layer boundaries
    for (const file of files) {
      for (const imp of file.imports) {
        const resolvedImport = resolveRelativeImport(file.path, imp);
        if (!resolvedImport) continue;

        for (const [layer, allowed] of Object.entries(layerRules)) {
          if (file.path.startsWith(layer)) {
            const importInAllowedLayer = allowed.some((a) => resolvedImport.startsWith(a));
            if (!importInAllowedLayer && !resolvedImport.startsWith(layer)) {
              violations.push({
                type: "layer-breach",
                severity: "critical",
                files: [file.path],
                message: `Layer breach: ${file.path} imports from "${resolvedImport}" (outside allowed layers: ${allowed.join(", ")})`,
                suggestion: `Move shared code to a common layer or restructure the import`,
              });
            }
            break;
          }
        }
      }
    }

    // 6. Detect orphan files (source files never imported by anyone)
    const allImported = new Set<string>();
    for (const f of files) {
      for (const imp of f.imports) {
        const resolved = resolveRelativeImport(f.path, imp);
        if (resolved) allImported.add(resolved);
        // Also match partial (without extension)
        allImported.add(imp);
      }
    }

    for (const file of files) {
      if (file.isTest || file.isStory) continue;
      if (basename(file.path) === "index.ts") continue;
      if (file.exports.length === 0) continue;

      const isImported =
        allImported.has(file.path) ||
        allImported.has(file.path.replace(/\.[^.]+$/, "")) ||
        allImported.has(`./${file.path}`) ||
        allImported.has(`./${file.path.replace(/\.[^.]+$/, "")}`);

      // Check if any import string partially matches this file
      const fileBase = basename(file.path).replace(/\.[^.]+$/, "");
      const partialMatch = [...allImported].some((imp) => imp.includes(fileBase));

      if (!isImported && !partialMatch) {
        violations.push({
          type: "orphan",
          severity: "info",
          files: [file.path],
          message: `Orphan file: "${file.path}" exports [${file.exports.join(", ")}] but is never imported`,
          suggestion: "Remove if unused, or add to a barrel file / entry point",
        });
      }
    }

    // Compute health score
    const weights = { "circular-dep": 15, naming: 3, "barrel-gap": 2, "layer-breach": 10, orphan: 1 };
    const totalPenalty = violations.reduce(
      (sum, v) => sum + (weights[v.type] ?? 1),
      0,
    );
    const maxScore = Math.max(files.length, 1);
    const healthScore = Math.max(0, Math.round(100 - (totalPenalty / maxScore) * 100));

    const stats = {
      filesAnalyzed: files.length,
      circularDeps: cycles.length,
      namingViolations: violations.filter((v) => v.type === "naming").length,
      barrelGaps: violations.filter((v) => v.type === "barrel-gap").length,
      layerBreaches: violations.filter((v) => v.type === "layer-breach").length,
      orphanFiles: violations.filter((v) => v.type === "orphan").length,
    };

    ctx.logger.info(
      `[arch-drift] ${files.length} files, ${violations.length} violations, health=${healthScore}`,
    );

    return {
      output: { violations, healthScore, stats, importGraph },
      evidence: [
        `violations=${violations.length}`,
        `health=${healthScore}`,
        `cycles=${cycles.length}`,
      ],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function buildImportGraph(files: FileEntry[]): Record<string, string[]> {
  // Build a lookup: "src/lib/b" → "src/lib/b.ts" (without extension → with extension)
  const pathLookup = new Map<string, string>();
  for (const f of files) {
    pathLookup.set(f.path, f.path);
    // Also register without extension for extensionless imports
    const noExt = f.path.replace(/\.[^.]+$/, "");
    if (!pathLookup.has(noExt)) pathLookup.set(noExt, f.path);
  }

  const graph: Record<string, string[]> = {};
  for (const f of files) {
    graph[f.path] = f.imports
      .map((imp) => {
        const resolved = resolveRelativeImport(f.path, imp);
        if (!resolved) return null;
        // Match to actual file path (with extension)
        return pathLookup.get(resolved) ?? resolved;
      })
      .filter((r): r is string => r !== null);
  }
  return graph;
}

/** Resolve "./foo" relative to "src/bar/baz.ts" → "src/bar/foo" */
function resolveRelativeImport(from: string, imp: string): string | null {
  if (!imp.startsWith(".")) return null; // Skip package imports

  const dir = from.split("/").slice(0, -1).join("/");
  const parts = imp.split("/");
  const resolved: string[] = dir ? dir.split("/") : [];

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join("/");
}

/** Detect cycles using DFS with coloring */
function detectCycles(graph: Record<string, string[]>): string[][] {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const cycles: string[][] = [];
  const maxCycles = 10; // Limit to prevent explosion

  for (const node of Object.keys(graph)) {
    color.set(node, WHITE);
  }

  function dfs(u: string): void {
    if (cycles.length >= maxCycles) return;
    color.set(u, GRAY);

    for (const v of graph[u] ?? []) {
      if (!graph[v]) continue; // Skip external nodes
      if (cycles.length >= maxCycles) return;

      if (color.get(v) === GRAY) {
        // Found a cycle — reconstruct it
        const cycle = [v];
        let cur = u;
        while (cur !== v) {
          cycle.push(cur);
          cur = parent.get(cur) ?? v;
          if (cycle.length > 50) break; // Safety
        }
        cycle.reverse();
        cycles.push(cycle);
      } else if (color.get(v) === WHITE) {
        parent.set(v, u);
        dfs(v);
      }
    }

    color.set(u, BLACK);
  }

  for (const node of Object.keys(graph)) {
    if (color.get(node) === WHITE) {
      parent.set(node, null);
      dfs(node);
    }
  }

  return cycles;
}
