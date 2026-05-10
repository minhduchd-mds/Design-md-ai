import type { SerializedNode, ScanIssue } from "../../shared/types";
import { detectViewport, type ViewportType } from "../../shared/viewport";
import { buildPath } from "./utils";

export interface MetaResult {
  score: number;
  issues: ScanIssue[];
  stats: {
    hiddenLayers: number;
    emptyFrames: number;
    viewport: ViewportInfo | null;
  };
}

interface ViewportInfo {
  type: ViewportType;
  width: number;
}

function detectViewportInfo(width: number): ViewportInfo {
  return { type: detectViewport(width), width };
}

const DIVIDER_NAME_PATTERN = /divider|separator|line|hr|col-?div|rule|h-?rule|border|sep\b|stroke/;

interface WalkState {
  hiddenLayers: { id: string; name: string; path: string }[];
  emptyFrames: { id: string; name: string; path: string; kind: "divider" | "spacer" | "placeholder" }[];
  issues: ScanIssue[];
}

function walkTree(node: SerializedNode, ancestors: string[], state: WalkState, insideInstance = false) {
  const path = buildPath(ancestors, node.name);
  const isInInstance = insideInstance || node.isInstance === true;

  // Hidden layers — only flag if deletable (not inside an instance)
  if (node.visible === false && !isInInstance) {
    state.hiddenLayers.push({ id: node.id, name: node.name, path });
  }

  // Empty frames (frames with no children) — distinguish spacer vs placeholder.
  // Skip nodes inside instances: their structure is read-only, so flagged
  // empty/divider/spacer frames cannot be acted on by the Quick Fix buttons.
  const isFrame = node.type === "FRAME" || node.type === "COMPONENT" || node.type === "GROUP";
  if (isFrame && (!node.children || node.children.length === 0) && !isInInstance) {
    const lowerName = node.name.toLowerCase();
    const hasFill = node.fills && node.fills.length > 0;
    const h = node.height ?? 0;
    const w = node.width ?? 0;

    const isThinHorizontal = h <= 4 && w > 20;
    const isThinVertical = w <= 4 && h > 20;
    const isThinDivider = isThinHorizontal || isThinVertical;

    // Check for visual purpose: fills (solid, image, gradient), strokes
    const hasVisibleFill = node.fills?.some((f) => f.type === "SOLID" || f.type === "IMAGE") ?? false;
    const hasStroke = node.strokes && node.strokes.length > 0;
    const hasVisualPurpose = (hasVisibleFill && !isThinDivider) || !!hasStroke;

    // Skip frames with visual content — they're intentional (bg color, image, shape)
    if (hasVisualPurpose && !/spacer|gap|spacing/.test(lowerName)) {
      // Has fill/stroke/image → not empty, has a visual purpose
    } else if (!hasFill && DIVIDER_NAME_PATTERN.test(lowerName) && isThinDivider) {
      // Properly converted or properly named thin divider — not an issue
    } else {
      let kind: "divider" | "spacer" | "placeholder";
      if (isThinDivider && hasFill) {
        kind = "divider";
      } else if (/spacer|gap|spacing/.test(lowerName) || (!hasFill && h > 0 && h <= 32 && w > 20)) {
        kind = "spacer";
      } else if (DIVIDER_NAME_PATTERN.test(lowerName)) {
        kind = "divider";
      } else {
        kind = "placeholder";
      }

      state.emptyFrames.push({ id: node.id, name: node.name, path, kind });
    }
  }

  // Check for inconsistent spacing among siblings
  if (node.children && node.children.length > 2 && !node.layoutMode) {
    const yPositions = node.children
      .filter((c) => c.y !== undefined && c.height !== undefined)
      .sort((a, b) => a.y! - b.y!);

    if (yPositions.length > 2) {
      const gaps: number[] = [];
      for (let i = 1; i < yPositions.length; i++) {
        const gap = yPositions[i].y! - (yPositions[i - 1].y! + yPositions[i - 1].height!);
        if (gap > 0) gaps.push(Math.round(gap));
      }

      if (gaps.length > 1) {
        const uniqueGaps = new Set(gaps);
        if (uniqueGaps.size > 2) {
          state.issues.push({
            id: `meta-inconsistent-spacing-${node.id}`,
            category: "meta",
            severity: "info",
            message: `"${node.name}" has inconsistent vertical spacing between children: ${Array.from(uniqueGaps).join(", ")}px. AI may not reproduce the intended spacing.`,
            path,
            suggestion: "Use Auto Layout with consistent itemSpacing, or align spacing to a grid.",
            nodeId: node.id,
          });
        }
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      walkTree(child, [...ancestors, node.name], state, isInInstance);
    }
  }
}

export function scoreMeta(node: SerializedNode): MetaResult {
  const state: WalkState = {
    hiddenLayers: [],
    emptyFrames: [],
    issues: [],
  };

  walkTree(node, [], state);

  let score = 80; // base

  // Viewport detection
  const viewport = node.width ? detectViewportInfo(node.width) : null;

  // Hidden layers
  if (state.hiddenLayers.length > 0) {
    score -= Math.min(10, state.hiddenLayers.length * 2);

    // Always create individual issues with nodeId so FixPanel can delete them
    for (const layer of state.hiddenLayers) {
      state.issues.push({
        id: `meta-hidden-${layer.id}`,
        category: "meta",
        severity: state.hiddenLayers.length > 5 ? "warning" : "info",
        message: `"${layer.name}" is hidden. Hidden layers increase token cost without adding value.`,
        path: layer.path,
        suggestion: "Delete this hidden layer or make it visible if needed.",
        nodeId: layer.id,
      });
    }
  }

  // Empty frames — different treatment per kind
  if (state.emptyFrames.length > 0) {
    const dividers = state.emptyFrames.filter((f) => f.kind === "divider");
    const spacers = state.emptyFrames.filter((f) => f.kind === "spacer");
    const placeholders = state.emptyFrames.filter((f) => f.kind === "placeholder");

    for (const frame of dividers) {
      state.issues.push({
        id: `meta-divider-frame-${frame.id}`,
        category: "meta",
        severity: "info",
        message: `"${frame.name}" looks like a divider but is built as a Frame with background fill. AI may render it as a <div> instead of <hr>.`,
        path: frame.path,
        suggestion: "Convert to a Line node for proper AI recognition as a divider.",
        nodeId: frame.id,
      });
    }

    for (const frame of spacers.slice(0, 3)) {
      state.issues.push({
        id: `meta-spacer-${frame.id}`,
        category: "meta",
        severity: "info",
        message: `"${frame.name}" is a spacer frame. AI handles Auto Layout gap/padding better than empty frames.`,
        path: frame.path,
        suggestion: "Consider replacing with Auto Layout gap or padding.",
        nodeId: frame.id,
      });
    }

    score -= Math.min(10, placeholders.length * 3);
    for (const frame of placeholders.slice(0, 5)) {
      state.issues.push({
        id: `meta-empty-${frame.id}`,
        category: "meta",
        severity: "warning",
        message: `"${frame.name}" is an empty frame with no children. AI will generate an empty container.`,
        path: frame.path,
        suggestion: "Remove this frame or add content. It looks like a forgotten placeholder.",
        nodeId: frame.id,
      });
    }
  }

  // Viewport info
  if (viewport) {
    if (viewport.type === "unknown") {
      score -= 5;
      state.issues.push({
        id: `meta-unknown-viewport-${node.id}`,
        category: "meta",
        severity: "info",
        message: `Frame width ${viewport.width}px doesn't match common viewport sizes. AI may not correctly infer the target device.`,
        path: node.name,
        suggestion: "Use standard viewport widths: 375/390px (mobile), 768/1024px (tablet), 1280/1440px (desktop).",
        nodeId: node.id,
      });
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues: state.issues,
    stats: {
      hiddenLayers: state.hiddenLayers.length,
      emptyFrames: state.emptyFrames.length,
      viewport,
    },
  };
}
