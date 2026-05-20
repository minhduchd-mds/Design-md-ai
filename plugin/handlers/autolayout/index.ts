/**
 * autolayout — Auto Layout analysis and conversion for Figma frames.
 *
 * Split into modules:
 *   - analysis.ts  — frame child geometry analysis
 *   - alignment.ts — alignment detection + child sizing (pure, testable)
 *   - apply.ts     — conversion engine + confidence scoring
 */

import type { PluginMessage, AutoLayoutCandidate, AutoLayoutSkipped } from "../../../shared/types";
import { sendSelection } from "../selection";
import { analyzeFrame, applyAutoLayout } from "./apply";

// Re-export pure functions for testing
export {
  type AlignmentChild,
  type ChildSizingInput,
  canHugContent,
  decideChildSizing,
  detectPrimaryAlignment,
  detectCounterAlignment,
  gapVariance,
} from "./alignment";

export async function handleAutoLayoutMessage(msg: PluginMessage): Promise<boolean> {
  switch (msg.type) {
    case "request-autolayout-analysis": {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) return true;

      const candidates: AutoLayoutCandidate[] = [];
      const skipped: AutoLayoutSkipped[] = [];
      analyzeFrame(selection[0], 0, candidates, skipped);

      candidates.sort((a, b) => b.depth - a.depth);

      const response: PluginMessage = { type: "autolayout-analysis-result", candidates, skipped };
      figma.ui.postMessage(response);
      return true;
    }
    case "apply-autolayout": {
      const nodeIdSet = new Set(msg.nodeIds);
      const count = applyAutoLayout(nodeIdSet);
      const response: PluginMessage = { type: "autolayout-applied", count };
      figma.ui.postMessage(response);
      sendSelection();
      return true;
    }
    default:
      return false;
  }
}
