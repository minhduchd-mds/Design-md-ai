import type { SerializedNode, ScanResult, ScanCategory, ViewportVariant, PluginProfile } from "../../shared/types";
import { SCORE_WEIGHTS } from "../../shared/types";
import { scoreNaming } from "./scoring-naming";
import { scoreStructure } from "./scoring-structure";
import { scoreTokens } from "./scoring-tokens";
import { scoreMeta } from "./scoring-meta";
import { scoreCompleteness } from "./scoring-completeness";
import { scoreVariants } from "./scoring-variants";
import { generateCompactPrompt } from "./prompt-compact";
import { analyzeAtomic, buildExportPlan } from "./atomic-detection";
import { SCORE_UNLOCK_THRESHOLD } from "../../shared/constants";

// Const severity lookup — created once, not on every sort call.
const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

function toStatus(score: number): "red" | "yellow" | "green" {
  if (score >= SCORE_UNLOCK_THRESHOLD) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

// ── LRU scan cache ────────────────────────────────────────────────────────────
// Caches results by nodeId so switching between recently-visited nodes
// avoids re-running all 6 scoring modules (O(n) tree walks each).
// Capacity: 10 entries — small enough to never cause memory pressure.

interface CacheEntry {
  result: ScanResult;
  profileId: string | null; // invalidate when profile changes
}

const CACHE_MAX = 10;
const scanCache = new Map<string, CacheEntry>();

function cacheGet(nodeId: string, profileId: string | null): ScanResult | null {
  const entry = scanCache.get(nodeId);
  if (!entry || entry.profileId !== profileId) return null;
  // Move to end (LRU refresh)
  scanCache.delete(nodeId);
  scanCache.set(nodeId, entry);
  return entry.result;
}

function cacheSet(nodeId: string, profileId: string | null, result: ScanResult): void {
  if (scanCache.size >= CACHE_MAX) {
    // Evict oldest (first) entry
    scanCache.delete(scanCache.keys().next().value!);
  }
  scanCache.set(nodeId, { result, profileId });
}

/** Manually invalidate a cached entry (call after fixes are applied). */
export function invalidateScanCache(nodeId: string): void {
  scanCache.delete(nodeId);
}

// ─────────────────────────────────────────────────────────────────────────────

export function scan(
  node: SerializedNode,
  variants?: ViewportVariant[],
  profile?: PluginProfile | null,
  opts?: { skipSkillSync?: boolean },
): ScanResult {
  const profileId = profile?.id ?? null;

  // Skip full rescan if we have a cached result for this node + profile combination.
  // Variants and skipSkillSync are transient — don't affect scoring, only prompt generation.
  const cached = !opts?.skipSkillSync ? cacheGet(node.id, profileId) : null;
  if (cached) return cached;

  const naming       = scoreNaming(node);
  const structure    = scoreStructure(node);
  const tokens       = scoreTokens(node, profile);
  const meta         = scoreMeta(node);
  const completeness = scoreCompleteness(node);
  const variantsResult = scoreVariants(node);

  const score = Math.round(
    naming.score       * SCORE_WEIGHTS.naming +
    structure.score    * SCORE_WEIGHTS.structure +
    tokens.score       * SCORE_WEIGHTS.tokens +
    meta.score         * SCORE_WEIGHTS.meta +
    completeness.score * SCORE_WEIGHTS.completeness +
    variantsResult.score * SCORE_WEIGHTS.variants,
  );

  const categories: ScanCategory[] = [
    { id: "naming",       label: "Naming",       score: naming.score,        status: toStatus(naming.score) },
    { id: "structure",    label: "Structure",    score: structure.score,     status: toStatus(structure.score) },
    { id: "tokens",       label: "Tokens",       score: tokens.score,        status: toStatus(tokens.score) },
    { id: "meta",         label: "Meta",         score: meta.score,          status: toStatus(meta.score) },
    { id: "completeness", label: "Completeness", score: completeness.score,  status: toStatus(completeness.score) },
    { id: "variants",     label: "Variants",     score: variantsResult.score, status: toStatus(variantsResult.score) },
  ];

  const allIssues = [
    ...naming.issues, ...structure.issues, ...tokens.issues,
    ...meta.issues, ...completeness.issues, ...variantsResult.issues,
  ].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));

  const atomicInfo = analyzeAtomic(node);
  const exportPlan = buildExportPlan([atomicInfo]);

  const promptOpts = { variants, profile, atomicInfo, skipSkillSync: opts?.skipSkillSync };
  const promptCompact = score >= SCORE_UNLOCK_THRESHOLD ? generateCompactPrompt(node, promptOpts) : undefined;

  const result: ScanResult = {
    score, categories, issues: allIssues, promptCompact,
    colorMappings: tokens.colorMappings, atomicInfo, exportPlan,
  };

  if (!opts?.skipSkillSync) cacheSet(node.id, profileId, result);
  return result;
}
