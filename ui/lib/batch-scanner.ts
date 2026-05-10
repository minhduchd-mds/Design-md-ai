import type {
  SerializedNode,
  PluginProfile,
  BatchItemResult,
  BatchScanResult,
  AtomicLevel,
} from "../../shared/types";
import { scan } from "./scanner";
import { analyzeAtomic, buildExportPlan } from "./atomic-detection";
import { renderSkillSyncBlock } from "./prompt-compact";

/**
 * Scan multiple nodes and produce a batch result sorted by atomic level.
 * Atoms are scanned first, then molecules, then organisms.
 */
export function batchScan(
  nodes: SerializedNode[],
  profile?: PluginProfile | null,
): BatchScanResult {
  const items: BatchItemResult[] = nodes.map((node) => {
    const atomicInfo = analyzeAtomic(node);
    const scanResult = scan(node, undefined, profile, { skipSkillSync: true });
    return {
      name: node.componentName ?? node.name,
      nodeId: node.id,
      score: scanResult.score,
      atomicLevel: atomicInfo.level,
      scanResult,
    };
  });

  // Sort by atomic level: atoms first, then molecules, then organisms
  const levelOrder: Record<AtomicLevel, number> = { unclassified: 0, atom: 1, molecule: 2, organism: 3 };
  items.sort((a, b) => {
    const levelDiff = levelOrder[a.atomicLevel] - levelOrder[b.atomicLevel];
    if (levelDiff !== 0) return levelDiff;
    return a.score - b.score;
  });

  const atomicInfos = items.map((item) => item.scanResult.atomicInfo!).filter(Boolean);
  const exportPlan = buildExportPlan(atomicInfos);

  const averageScore = items.length > 0 ? Math.round(items.reduce((sum, i) => sum + i.score, 0) / items.length) : 0;

  const batchPromptCompact = averageScore >= 60 ? generateBatchPromptCompact(items, profile) : undefined;

  return { items, exportPlan, batchPromptCompact, averageScore };
}

function generateBatchPromptCompact(items: BatchItemResult[], profile?: PluginProfile | null): string {
  const stack = profile?.stack ?? "React+TS+CSS";
  const lines: string[] = [];
  lines.push(`# batch → ${stack}`);
  lines.push("# DesignReady.ai batch spec — build atoms first, then compose");
  lines.push("");

  if (profile) {
    lines.push(`system: ${profile.name}`);
    if (Object.keys(profile.tokens).length > 0) {
      lines.push(
        `tokens: ${Object.entries(profile.tokens)
          .slice(0, 20)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ")}`,
      );
    }
    lines.push("");
  }

  lines.push("## order");
  items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name} [${item.atomicLevel}] score:${item.score}`);
  });
  lines.push("");

  // Include individual compact prompts (skill-sync skipped at generation — batch has its own at the end)
  for (const item of items) {
    if (item.scanResult.promptCompact) {
      lines.push("---");
      lines.push(item.scanResult.promptCompact);
    }
  }

  // ── TASK 2: Skill Sync (mandatory, clearly separated) ──
  if (profile) {
    lines.push("");
    lines.push("---");
    lines.push(renderSkillSyncBlock(profile));
  }

  return lines.join("\n");
}
