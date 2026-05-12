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

// Hoisted outside function — created once at module load, never re-allocated.
const LEVEL_ORDER: Record<AtomicLevel, number> = { unclassified: 0, atom: 1, molecule: 2, organism: 3 };

/**
 * Scan multiple nodes and produce a batch result sorted by atomic level.
 * Atoms first, then molecules, then organisms.
 *
 * @param onProgress Optional callback fired after each node is scanned.
 *                   Receives (completed, total) — use to drive a progress bar.
 */
export function batchScan(
  nodes: SerializedNode[],
  profile?: PluginProfile | null,
  onProgress?: (completed: number, total: number) => void,
): BatchScanResult {
  const total = nodes.length;
  const items: BatchItemResult[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const atomicInfo  = analyzeAtomic(node);
    const scanResult  = scan(node, undefined, profile, { skipSkillSync: true });
    items.push({
      name: node.componentName ?? node.name,
      nodeId: node.id,
      score: scanResult.score,
      atomicLevel: atomicInfo.level,
      scanResult,
    });
    onProgress?.(i + 1, total);
  }

  // Sort: atoms → molecules → organisms; within same level sort by score ascending
  items.sort((a, b) => {
    const levelDiff = LEVEL_ORDER[a.atomicLevel] - LEVEL_ORDER[b.atomicLevel];
    return levelDiff !== 0 ? levelDiff : a.score - b.score;
  });

  const atomicInfos = items.map((item) => item.scanResult.atomicInfo!).filter(Boolean);
  const exportPlan  = buildExportPlan(atomicInfos);
  const averageScore =
    items.length > 0
      ? Math.round(items.reduce((sum, i) => sum + i.score, 0) / items.length)
      : 0;

  const batchPromptCompact =
    averageScore >= 60 ? generateBatchPromptCompact(items, profile) : undefined;

  return { items, exportPlan, batchPromptCompact, averageScore };
}

function generateBatchPromptCompact(
  items: BatchItemResult[],
  profile?: PluginProfile | null,
): string {
  const stack = profile?.stack ?? "React+TS+CSS";
  const lines: string[] = [
    `# batch → ${stack}`,
    "# DesignReady.ai batch spec — build atoms first, then compose",
    "",
  ];

  if (profile) {
    lines.push(`system: ${profile.name}`);
    const tokenEntries = Object.entries(profile.tokens).slice(0, 20);
    if (tokenEntries.length > 0) {
      lines.push(`tokens: ${tokenEntries.map(([k, v]) => `${k}=${v}`).join(" ")}`);
    }
    lines.push("");
  }

  lines.push("## order");
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    lines.push(`${i + 1}. ${item.name} [${item.atomicLevel}] score:${item.score}`);
  }
  lines.push("");

  for (const item of items) {
    if (item.scanResult.promptCompact) {
      lines.push("---");
      lines.push(item.scanResult.promptCompact);
    }
  }

  if (profile) {
    lines.push("", "---");
    lines.push(renderSkillSyncBlock(profile));
  }

  return lines.join("\n");
}
