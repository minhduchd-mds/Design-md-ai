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

function toStatus(score: number): "red" | "yellow" | "green" {
  if (score >= 75) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

export function scan(
  node: SerializedNode,
  variants?: ViewportVariant[],
  profile?: PluginProfile | null,
  opts?: { skipSkillSync?: boolean },
): ScanResult {
  const naming = scoreNaming(node);
  const structure = scoreStructure(node);
  const tokens = scoreTokens(node, profile);
  const meta = scoreMeta(node);
  const completeness = scoreCompleteness(node);
  const variantsResult = scoreVariants(node);

  const score = Math.round(
    naming.score * SCORE_WEIGHTS.naming +
      structure.score * SCORE_WEIGHTS.structure +
      tokens.score * SCORE_WEIGHTS.tokens +
      meta.score * SCORE_WEIGHTS.meta +
      completeness.score * SCORE_WEIGHTS.completeness +
      variantsResult.score * SCORE_WEIGHTS.variants,
  );

  const categories: ScanCategory[] = [
    { id: "naming", label: "Naming", score: naming.score, status: toStatus(naming.score) },
    { id: "structure", label: "Structure", score: structure.score, status: toStatus(structure.score) },
    { id: "tokens", label: "Tokens", score: tokens.score, status: toStatus(tokens.score) },
    { id: "meta", label: "Meta", score: meta.score, status: toStatus(meta.score) },
    { id: "completeness", label: "Completeness", score: completeness.score, status: toStatus(completeness.score) },
    { id: "variants", label: "Variants", score: variantsResult.score, status: toStatus(variantsResult.score) },
  ];

  const allIssues = [
    ...naming.issues,
    ...structure.issues,
    ...tokens.issues,
    ...meta.issues,
    ...completeness.issues,
    ...variantsResult.issues,
  ].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  // Atomic Detection
  const atomicInfo = analyzeAtomic(node);
  const exportPlan = buildExportPlan([atomicInfo]);

  const promptOpts = { variants, profile, atomicInfo, skipSkillSync: opts?.skipSkillSync };
  const promptCompact = score >= 75 ? generateCompactPrompt(node, promptOpts) : undefined;

  return {
    score,
    categories,
    issues: allIssues,
    promptCompact,
    colorMappings: tokens.colorMappings,
    atomicInfo,
    exportPlan,
  };
}
