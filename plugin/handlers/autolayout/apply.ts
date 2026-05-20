/**
 * autolayout/apply — Auto Layout conversion engine.
 *
 * Converts analyzed frame candidates to Figma Auto Layout, applying
 * direction, gap, padding, alignment and child sizing bottom-up.
 */

import type { AutoLayoutCandidate, AutoLayoutSkipped } from "../../../shared/types";
import {
  getVisibleChildren,
  hasOverlap,
  detectDirection,
  calculateGap,
  calculatePadding,
  type ChildInfo,
} from "./analysis";
import {
  detectPrimaryAlignment,
  detectCounterAlignment,
  decideChildSizing,
  gapVariance,
} from "./alignment";

const SPACE_BETWEEN_GAP_TOL = 8;

function calculateConfidence(
  children: ChildInfo[],
  direction: "HORIZONTAL" | "VERTICAL",
  gap: number,
): number {
  let confidence = 0.7;

  const sorted =
    direction === "HORIZONTAL"
      ? [...children].sort((a, b) => a.x - b.x)
      : [...children].sort((a, b) => a.y - b.y);

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const g =
      direction === "HORIZONTAL"
        ? curr.x - (prev.x + prev.width)
        : curr.y - (prev.y + prev.height);
    gaps.push(Math.round(g));
  }

  if (gaps.length > 0) {
    const variance = gaps.reduce((sum, g) => sum + Math.abs(g - gap), 0) / gaps.length;
    if (variance <= 1) confidence += 0.2;
    else if (variance <= 4) confidence += 0.1;
    else confidence -= 0.1;
  }

  if (children.length >= 3) confidence += 0.05;
  if (gap % 4 === 0) confidence += 0.05;

  return Math.min(1, Math.max(0, Math.round(confidence * 100) / 100));
}

export function analyzeFrame(
  node: SceneNode,
  depth: number,
  candidates: AutoLayoutCandidate[],
  skipped: AutoLayoutSkipped[],
): void {
  const isFrame = node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET";
  if (!isFrame) return;

  const frame = node as FrameNode;

  if ("children" in frame) {
    for (const child of frame.children) {
      analyzeFrame(child, depth + 1, candidates, skipped);
    }
  }

  if (frame.layoutMode && frame.layoutMode !== "NONE") return;
  if ((node as SceneNode).type === "INSTANCE") return;

  const children = getVisibleChildren(frame);

  if (children.length < 2) {
    if (children.length === 1) {
      skipped.push({
        nodeId: node.id,
        name: node.name,
        reason: "Only 1 visible child — no layout pattern to detect",
      });
    }
    return;
  }

  if (hasOverlap(children)) {
    skipped.push({
      nodeId: node.id,
      name: node.name,
      reason: "Children overlap — likely decorative positioning",
    });
    return;
  }

  const SHAPE_TYPES = new Set(["VECTOR", "LINE", "ELLIPSE", "RECTANGLE", "STAR", "POLYGON", "BOOLEAN_OPERATION"]);
  const allShapes = children.every((c) => SHAPE_TYPES.has(c.node.type));
  if (allShapes) {
    skipped.push({
      nodeId: node.id,
      name: node.name,
      reason: "All children are shapes — likely an icon or illustration",
    });
    return;
  }

  const direction = detectDirection(children);
  if (!direction) {
    skipped.push({
      nodeId: node.id,
      name: node.name,
      reason: "Ambiguous layout — can't determine row vs column",
    });
    return;
  }

  const gap = calculateGap(children, direction);
  const padding = calculatePadding(
    { width: Math.round(frame.width), height: Math.round(frame.height) },
    children,
  );
  const frameMain = direction === "HORIZONTAL" ? Math.round(frame.width) : Math.round(frame.height);
  const alignment = detectPrimaryAlignment(children, direction, frameMain, padding);
  const confidence = calculateConfidence(children, direction, gap);

  if (alignment === "SPACE_BETWEEN" && gapVariance(children, direction) > SPACE_BETWEEN_GAP_TOL) {
    skipped.push({
      nodeId: node.id,
      name: node.name,
      reason:
        "Uneven gaps suggest a 'value-pinned-right' pattern — group related children manually first, then re-scan",
    });
    return;
  }

  if (confidence < 0.6) {
    skipped.push({
      nodeId: node.id,
      name: node.name,
      reason: `Low confidence (${Math.round(confidence * 100)}%) — inconsistent spacing`,
    });
    return;
  }

  candidates.push({
    nodeId: node.id,
    name: node.name,
    depth,
    direction,
    gap,
    padding,
    alignment,
    childCount: children.length,
    confidence,
  });
}

export function applyAutoLayout(nodeIds: Set<string>): number {
  let count = 0;

  const nodesToConvert: { node: FrameNode; depth: number }[] = [];
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return 0;

  const outermostId = selection[0].id;

  function collectNodes(node: SceneNode, depth: number) {
    if (nodeIds.has(node.id) && (node.type === "FRAME" || node.type === "COMPONENT")) {
      nodesToConvert.push({ node: node as FrameNode, depth });
    }
    if ("children" in node) {
      for (const child of (node as FrameNode).children) {
        collectNodes(child, depth + 1);
      }
    }
  }

  collectNodes(selection[0], 0);
  nodesToConvert.sort((a, b) => b.depth - a.depth);

  const origSizes = new Map<string, { width: number; height: number }>();

  for (const { node: frame } of nodesToConvert) {
    const children = getVisibleChildren(frame);
    if (children.length < 2) continue;

    const direction = detectDirection(children);
    if (!direction) continue;

    const origWidth = Math.round(frame.width);
    const origHeight = Math.round(frame.height);
    origSizes.set(frame.id, { width: origWidth, height: origHeight });

    const gap = calculateGap(children, direction);
    const padding = calculatePadding(
      { width: origWidth, height: origHeight },
      children,
    );
    const frameMain = direction === "HORIZONTAL" ? origWidth : origHeight;
    const frameCross = direction === "HORIZONTAL" ? origHeight : origWidth;
    const primaryAlign = detectPrimaryAlignment(children, direction, frameMain, padding);
    const counterAlign = detectCounterAlignment(children, direction, frameCross, padding);

    frame.layoutMode = direction;
    frame.itemSpacing = gap;
    frame.paddingTop = padding.top;
    frame.paddingRight = padding.right;
    frame.paddingBottom = padding.bottom;
    frame.paddingLeft = padding.left;
    frame.primaryAxisAlignItems = primaryAlign;
    frame.counterAxisAlignItems = counterAlign;

    const innerWidth = origWidth - padding.left - padding.right;
    const innerHeight = origHeight - padding.top - padding.bottom;

    for (const childInfo of children) {
      const child = childInfo.node;
      if (!("layoutSizingHorizontal" in child)) continue;

      const childOrig = origSizes.get(child.id);
      const childWidth = childOrig?.width ?? childInfo.width;
      const childHeight = childOrig?.height ?? childInfo.height;

      const sizing = decideChildSizing(
        {
          width: childWidth,
          height: childHeight,
          type: childInfo.type,
          hasChildren: childInfo.hasChildren,
        },
        direction,
        innerWidth,
        innerHeight,
      );

      try {
        (child as FrameNode).layoutSizingHorizontal = sizing.horizontal;
        (child as FrameNode).layoutSizingVertical = sizing.vertical;
      } catch {
        // Some node types reject certain sizing modes
      }
    }

    if (frame.id === outermostId) {
      frame.layoutSizingHorizontal = "FIXED";
      frame.layoutSizingVertical = "FIXED";
      frame.resize(origWidth, origHeight);
    } else {
      const parent = frame.parent;
      const parentHasAL =
        parent &&
        "layoutMode" in parent &&
        (parent as FrameNode).layoutMode &&
        (parent as FrameNode).layoutMode !== "NONE";

      if (parentHasAL) {
        const p = parent as FrameNode;
        const pInnerWidth = Math.round(p.width) - p.paddingLeft - p.paddingRight;
        const pInnerHeight = Math.round(p.height) - p.paddingTop - p.paddingBottom;
        const sizing = decideChildSizing(
          {
            width: origWidth,
            height: origHeight,
            type: frame.type,
            hasChildren: frame.children.length > 0,
          },
          p.layoutMode as "HORIZONTAL" | "VERTICAL",
          pInnerWidth,
          pInnerHeight,
        );
        try {
          frame.layoutSizingHorizontal = sizing.horizontal;
          frame.layoutSizingVertical = sizing.vertical;
        } catch {
          frame.layoutSizingHorizontal = "HUG";
          frame.layoutSizingVertical = "HUG";
        }
      } else {
        frame.layoutSizingHorizontal = "HUG";
        frame.layoutSizingVertical = "HUG";
      }
    }

    count++;
  }

  return count;
}
