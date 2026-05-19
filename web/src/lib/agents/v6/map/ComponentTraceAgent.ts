/**
 * ComponentTraceAgent — maps Figma design components to code components.
 *
 * Given a Figma component name (e.g. "Button/Primary") and a RepoMap,
 * traces to the matching code file, exported symbol, and test file.
 *
 * Matching strategies (in priority order):
 *   1. Exact export name match (case-insensitive)
 *   2. Normalized name match (Button/Primary → Button → matches "Button.tsx")
 *   3. Fuzzy partial match on file path
 */

import { BaseAgentV6, type AgentContextV6, type FleetName } from "../BaseAgent";
import type { FileEntry } from "./RepoMapAgent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ComponentTraceInput {
  /** Figma component/node name (e.g. "Button/Primary", "Header", "NavBar") */
  figmaName: string;
  /** Optional Figma node ID for evidence linking */
  figmaNodeId?: string;
  /** Repo map file entries (from RepoMapAgent) */
  repoFiles: FileEntry[];
}

export interface ComponentTraceOutput {
  /** Whether a match was found */
  found: boolean;
  /** Match confidence: 0-1 */
  confidence: number;
  /** Matched code file (repo-relative path) */
  codeFile: string | null;
  /** Matched export name */
  exportName: string | null;
  /** Associated test file if found */
  testFile: string | null;
  /** Associated story file if found */
  storyFile: string | null;
  /** Match strategy used */
  matchStrategy: "exact" | "normalized" | "fuzzy" | "none";
  /** All candidate matches (for debugging / user selection) */
  candidates: TraceCandidate[];
}

export interface TraceCandidate {
  file: string;
  exportName: string;
  score: number;
  strategy: "exact" | "normalized" | "fuzzy";
}

export class ComponentTraceAgent extends BaseAgentV6<ComponentTraceInput, ComponentTraceOutput> {
  readonly id = "map.component-trace";
  readonly name = "Component Trace";
  readonly fleet: FleetName = "map";
  readonly role = "analyzer" as const;
  readonly description = "Maps Figma component names to code files and exports";

  protected async run(
    input: ComponentTraceInput,
    ctx: AgentContextV6,
  ): Promise<{ output: ComponentTraceOutput }> {
    const { figmaName, repoFiles } = input;
    const componentFiles = repoFiles.filter((f) => f.isComponent);

    // Normalize Figma name: "Button/Primary" → "Button", "nav-bar" → "NavBar"
    const normalized = normalizeFigmaName(figmaName);
    const normalizedLower = normalized.toLowerCase();

    const candidates: TraceCandidate[] = [];

    // Strategy 1: Exact export name match
    for (const file of componentFiles) {
      for (const exp of file.exports) {
        if (exp.toLowerCase() === normalizedLower) {
          candidates.push({ file: file.path, exportName: exp, score: 1.0, strategy: "exact" });
        }
      }
    }

    // Strategy 2: Normalized name in file path
    if (candidates.length === 0) {
      for (const file of componentFiles) {
        const fileName = file.path.split("/").pop()?.replace(/\.\w+$/, "") ?? "";
        if (fileName.toLowerCase() === normalizedLower) {
          const exp = file.exports.find((e) => e.toLowerCase() === normalizedLower) ?? file.exports[0] ?? fileName;
          candidates.push({ file: file.path, exportName: exp, score: 0.85, strategy: "normalized" });
        }
      }
    }

    // Strategy 3: Fuzzy partial match
    if (candidates.length === 0) {
      for (const file of componentFiles) {
        const score = fuzzyScore(normalizedLower, file.path.toLowerCase(), file.exports);
        if (score > 0.3) {
          const exp = file.exports.find((e) =>
            e.toLowerCase().includes(normalizedLower) || normalizedLower.includes(e.toLowerCase()),
          ) ?? file.exports[0] ?? "";
          candidates.push({ file: file.path, exportName: exp, score, strategy: "fuzzy" });
        }
      }
      candidates.sort((a, b) => b.score - a.score);
    }

    // Pick best match
    const best = candidates[0] ?? null;
    let testFile: string | null = null;
    let storyFile: string | null = null;

    if (best) {
      // Find associated test/story
      const baseName = best.file.replace(/\.\w+$/, "");
      testFile = repoFiles.find((f) => f.isTest && f.path.includes(baseName.split("/").pop()!))?.path ?? null;
      storyFile = repoFiles.find((f) => f.isStory && f.path.includes(baseName.split("/").pop()!))?.path ?? null;
    }

    ctx.logger.info(
      `[component-trace] "${figmaName}" → ${best ? `${best.file}:${best.exportName} (${best.strategy}, ${best.score.toFixed(2)})` : "no match"}`,
    );

    return {
      output: {
        found: best !== null,
        confidence: best?.score ?? 0,
        codeFile: best?.file ?? null,
        exportName: best?.exportName ?? null,
        testFile,
        storyFile,
        matchStrategy: best?.strategy ?? "none",
        candidates: candidates.slice(0, 5),
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** "Button/Primary" → "Button", "nav-bar" → "NavBar", "IconSet" → "IconSet" */
function normalizeFigmaName(name: string): string {
  // Take first segment before "/" (Figma variant separator)
  const base = name.split("/")[0].trim();
  // Convert kebab-case / snake_case to PascalCase
  return base
    .replace(/[-_]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase());
}

/** Simple fuzzy scoring based on substring overlap */
function fuzzyScore(query: string, filePath: string, exports: string[]): number {
  let best = 0;
  // Check file path
  if (filePath.includes(query)) best = Math.max(best, 0.6);
  // Check exports
  for (const exp of exports) {
    const expLower = exp.toLowerCase();
    if (expLower.includes(query)) best = Math.max(best, 0.7);
    if (query.includes(expLower) && expLower.length > 2) best = Math.max(best, 0.5);
  }
  // Levenshtein-style: shared prefix ratio
  const fileName = filePath.split("/").pop()?.replace(/\.\w+$/, "").toLowerCase() ?? "";
  const prefixLen = sharedPrefixLength(query, fileName);
  if (prefixLen >= 3) {
    best = Math.max(best, prefixLen / Math.max(query.length, fileName.length));
  }
  return best;
}

function sharedPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
