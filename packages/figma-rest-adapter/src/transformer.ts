/**
 * transformer — Walk a Figma REST API document tree and emit AuditNode[].
 *
 * Server-side equivalent of the plugin-side serializer. Computes the
 * minimum fields required by audit rules:
 *   - contrastRatio (text nodes)
 *   - hasInteractions (heuristic: COMPONENT/INSTANCE with "button"/"link" naming)
 *   - touchTargetCompliant
 *   - inferredRole
 *   - headingLevel (for text styled as H1-H6)
 */

import type { AuditNode } from "@desygn/audit-engine";
import { contrastRatio, figmaChannelToByte, type Rgb } from "@desygn/audit-engine";

interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];
  absoluteBoundingBox?: { width: number; height: number };
  characters?: string;
  style?: { fontSize?: number; fontWeight?: number };
  fills?: Array<{ type?: string; visible?: boolean; opacity?: number; color?: FigmaColor }>;
  backgrounds?: Array<{ type?: string; visible?: boolean; color?: FigmaColor }>;
  backgroundColor?: FigmaColor;
  componentId?: string;
  componentSetId?: string;
  /** Prototype interactions (authoritative interactivity/motion signal). */
  reactions?: FigmaReaction[];
}

interface FigmaReaction {
  trigger?: { type?: string };
  action?: { type?: string; transition?: { type?: string } | null };
  actions?: Array<{ type?: string; transition?: { type?: string } | null }>;
}

/** Trigger types that indicate a user-activated (interactive) element. */
const INTERACTIVE_TRIGGERS = new Set([
  "ON_CLICK",
  "ON_PRESS",
  "ON_HOVER",
  "MOUSE_DOWN",
  "MOUSE_UP",
  "ON_KEY_DOWN",
  "ON_DRAG",
]);

/** Transition types that animate (must respect prefers-reduced-motion). */
const MOTION_TRANSITIONS = new Set([
  "SMART_ANIMATE",
  "MOVE_IN",
  "MOVE_OUT",
  "PUSH",
  "SLIDE_IN",
  "SLIDE_OUT",
  "DISSOLVE",
]);

interface TransformContext {
  pageName: string;
  /** Nearest ancestor solid background color (for contrast computation). */
  backgroundRgb?: Rgb;
}

export function transformFigmaToAuditNodes(
  document: unknown,
  options: { maxDepth?: number } = {},
): AuditNode[] {
  const result: AuditNode[] = [];
  const maxDepth = options.maxDepth ?? 15;

  // Walk top-level pages (canvases)
  if (
    typeof document === "object" &&
    document !== null &&
    "children" in document
  ) {
    const pages = (document as { children?: FigmaNode[] }).children ?? [];
    for (const page of pages) {
      if (page.type !== "CANVAS") continue;
      walkNode(page, { pageName: page.name }, result, 0, maxDepth);
    }
  }

  return result;
}

function walkNode(
  node: FigmaNode,
  ctx: TransformContext,
  out: AuditNode[],
  depth: number,
  maxDepth: number,
): void {
  if (depth > maxDepth) return;
  if (node.visible === false) return;

  // Track the nearest solid background as we descend, so text contrast
  // can be computed against the effective background behind it.
  const ownBackground = extractSolidBackground(node);
  const childCtx: TransformContext = ownBackground
    ? { ...ctx, backgroundRgb: ownBackground }
    : ctx;

  const auditNode = toAuditNode(node, ctx);
  if (auditNode) out.push(auditNode);

  if (node.children) {
    for (const child of node.children) {
      walkNode(child, childCtx, out, depth + 1, maxDepth);
    }
  }
}

function toAuditNode(node: FigmaNode, ctx: TransformContext): AuditNode | null {
  if (node.type === "CANVAS" || node.type === "DOCUMENT") return null;

  const width = node.absoluteBoundingBox?.width;
  const height = node.absoluteBoundingBox?.height;
  const hasInteractions = inferInteractive(node);

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    pageName: ctx.pageName,
    width,
    height,
    text: node.characters,
    fontSize: node.style?.fontSize,
    fontWeight: node.style?.fontWeight,
    hasInteractions,
    inferredRole: inferRole(node, hasInteractions),
    touchTargetCompliant:
      width !== undefined && height !== undefined ? Math.min(width, height) >= 24 : undefined,
    headingLevel: inferHeadingLevel(node),
    contrastRatio: computeContrast(node, ctx.backgroundRgb),
    hasMotion: inferMotion(node),
  };
}

/** Extract a node's first visible solid fill/background as an RGB color. */
function extractSolidBackground(node: FigmaNode): Rgb | undefined {
  // Page-level backgroundColor
  if (node.backgroundColor) {
    return figmaColorToRgb(node.backgroundColor);
  }
  // Frame backgrounds[] or fills[] (first visible SOLID)
  const sources = [...(node.backgrounds ?? []), ...(node.fills ?? [])];
  for (const paint of sources) {
    if (paint.visible === false) continue;
    if (paint.type && paint.type !== "SOLID") continue;
    if (paint.color) return figmaColorToRgb(paint.color);
  }
  return undefined;
}

/** Compute contrast ratio for a TEXT node against the effective background. */
function computeContrast(node: FigmaNode, backgroundRgb?: Rgb): number | undefined {
  if (node.type !== "TEXT") return undefined;
  if (!backgroundRgb) return undefined;

  const textFill = (node.fills ?? []).find(
    (f) => f.visible !== false && (!f.type || f.type === "SOLID") && f.color,
  );
  if (!textFill?.color) return undefined;

  const textRgb = figmaColorToRgb(textFill.color);
  return Math.round(contrastRatio(textRgb, backgroundRgb) * 100) / 100;
}

function figmaColorToRgb(color: FigmaColor): Rgb {
  return {
    r: figmaChannelToByte(color.r),
    g: figmaChannelToByte(color.g),
    b: figmaChannelToByte(color.b),
  };
}

function inferInteractive(node: FigmaNode): boolean {
  // 1. Authoritative signal: prototype reactions with an interactive trigger.
  if (hasInteractiveReaction(node)) return true;

  // 2. Fallback heuristic: name keywords.
  const name = node.name.toLowerCase();
  const KEYWORDS = ["button", "btn", "link", "input", "checkbox", "radio", "switch", "tab", "menu"];
  return KEYWORDS.some((k) => name.includes(k));
}

/** True if the node has any prototype reaction with a user-activated trigger. */
function hasInteractiveReaction(node: FigmaNode): boolean {
  if (!Array.isArray(node.reactions)) return false;
  return node.reactions.some((r) => {
    const trigger = r.trigger?.type;
    return typeof trigger === "string" && INTERACTIVE_TRIGGERS.has(trigger);
  });
}

/** True if any reaction uses an animated transition (relevant to reduced-motion). */
function inferMotion(node: FigmaNode): boolean {
  if (!Array.isArray(node.reactions)) return false;
  return node.reactions.some((r) => {
    const actions = r.actions ?? (r.action ? [r.action] : []);
    return actions.some((a) => {
      const transition = a?.transition?.type;
      return typeof transition === "string" && MOTION_TRANSITIONS.has(transition);
    });
  });
}

function inferRole(node: FigmaNode, isInteractive: boolean): string {
  const name = node.name.toLowerCase();
  if (name.includes("button") || name.includes("btn")) return "button";
  if (name.includes("link")) return "link";
  if (name.includes("input") || name.includes("textfield")) return "textbox";
  if (name.includes("checkbox")) return "checkbox";
  if (name.includes("radio")) return "radio";
  if (name.includes("switch") || name.includes("toggle")) return "switch";
  if (name.includes("tab")) return "tab";
  if (name.includes("menu")) return "menu";
  if (name.includes("dialog") || name.includes("modal")) return "dialog";
  if (isInteractive) return "button";
  return "unknown";
}

function inferHeadingLevel(node: FigmaNode): number | undefined {
  if (node.type !== "TEXT") return undefined;
  const name = node.name.toLowerCase();
  const match = /h([1-6])/.exec(name);
  if (match) return parseInt(match[1], 10);

  // Heuristic: font size brackets
  const size = node.style?.fontSize;
  if (typeof size === "number") {
    if (size >= 40) return 1;
    if (size >= 32) return 2;
    if (size >= 24) return 3;
    if (size >= 20) return 4;
  }
  return undefined;
}
