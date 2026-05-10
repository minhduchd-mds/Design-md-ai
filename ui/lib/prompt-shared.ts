import type { SerializedNode, ViewportVariant, PluginProfile, AtomicInfo } from "../../shared/types";
import { colorToHex } from "./utils";

// ── Shared Options Interface ──

export interface PromptOptions {
  techStack?: string;
  variants?: ViewportVariant[];
  profile?: PluginProfile | null;
  atomicInfo?: AtomicInfo;
  /** Skip skill-sync block (used when embedded in batch prompt) */
  skipSkillSync?: boolean;
}

// ── Divider Detection ──

const DIVIDER_NAME_RE = /divider|separator|line|hr|col-?div|rule|h-?rule|border|sep\b|stroke/;

export function isDivider(node: SerializedNode): boolean {
  const nameLower = node.name.toLowerCase();
  const w = node.width ?? 0;
  const h = node.height ?? 0;
  const isThin = (h <= 4 && w > 20) || (w <= 4 && h > 20);
  return (
    node.type === "LINE" ||
    (node.type === "RECTANGLE" && !!w && !!h && (h <= 2 || w <= 2)) ||
    (!!node.isInstance && DIVIDER_NAME_RE.test(node.componentName?.toLowerCase() ?? "")) ||
    (node.type === "FRAME" && (!node.children || node.children.length === 0) && isThin) ||
    (node.type === "FRAME" && (!node.children || node.children.length === 0) && DIVIDER_NAME_RE.test(nameLower))
  );
}

// ── Icon Detection ──

const SHAPE_TYPES = new Set(["VECTOR", "LINE", "ELLIPSE", "RECTANGLE", "STAR", "POLYGON", "BOOLEAN_OPERATION"]);

export function isIconFrame(node: SerializedNode): boolean {
  if (!node.children || node.children.length === 0) return false;
  const visible = node.children.filter((c) => c.visible !== false);
  return visible.length > 0 && visible.every((c) => SHAPE_TYPES.has(c.type));
}

// ── Token Collection ──

export interface CollectedTokens {
  colors: Map<string, string[]>;
  colorVariables: Map<string, string>; // hex → variable name (from Figma)
  fontSizes: Map<number, string[]>;
  fonts: Map<string, number>;
  spacing: number[];
}

export function collectTokens(node: SerializedNode): CollectedTokens {
  const colors = new Map<string, string[]>();
  const colorVariables = new Map<string, string>();
  const fontSizes = new Map<number, string[]>();
  const fonts = new Map<string, number>();
  const spacingSet = new Set<number>();

  function collectPaints(paints: SerializedNode["fills"], nodeName: string, suffix = "") {
    if (!paints) return;
    for (const paint of paints) {
      if (paint.type === "SOLID" && paint.color) {
        const hex = colorToHex(paint.color);
        const list = colors.get(hex) ?? [];
        list.push(suffix ? `${nodeName} (${suffix})` : nodeName);
        colors.set(hex, list);
        if (paint.variableName && !colorVariables.has(hex)) {
          colorVariables.set(hex, paint.variableName);
        }
      }
      // Gradient stops → collect colors
      if (paint.gradientStops) {
        for (const stop of paint.gradientStops) {
          const hex = `#${stop.color.r.toString(16).padStart(2, "0")}${stop.color.g.toString(16).padStart(2, "0")}${stop.color.b.toString(16).padStart(2, "0")}`;
          const list = colors.get(hex) ?? [];
          list.push(`${nodeName} (gradient)`);
          colors.set(hex, list);
        }
      }
    }
  }

  function walk(n: SerializedNode) {
    collectPaints(n.fills, n.name);
    collectPaints(n.strokes, n.name, "border");

    if (n.type === "TEXT" && typeof n.fontSize === "number") {
      const sizeList = fontSizes.get(n.fontSize) ?? [];
      sizeList.push(n.name);
      fontSizes.set(n.fontSize, sizeList);

      const fontKey = n.fontName ? `${n.fontSize}/${n.fontName.style}` : `${n.fontSize}`;
      fonts.set(fontKey, (fonts.get(fontKey) ?? 0) + 1);
    }

    if (n.itemSpacing && n.itemSpacing > 0) spacingSet.add(n.itemSpacing);
    if (n.paddingTop && n.paddingTop > 0) spacingSet.add(n.paddingTop);
    if (n.paddingRight && n.paddingRight > 0) spacingSet.add(n.paddingRight);
    if (n.paddingBottom && n.paddingBottom > 0) spacingSet.add(n.paddingBottom);
    if (n.paddingLeft && n.paddingLeft > 0) spacingSet.add(n.paddingLeft);

    if (n.children) n.children.forEach(walk);
  }

  walk(node);
  return {
    colors,
    colorVariables,
    fontSizes,
    fonts,
    spacing: Array.from(spacingSet).sort((a, b) => a - b),
  };
}

// ── Atomic Level Rendering ──

export function renderAtomicCompact(atomicInfo: AtomicInfo): string {
  const lines: string[] = [];
  lines.push(`## atomic: ${atomicInfo.level}`);
  if (atomicInfo.subComponents.length > 0) {
    lines.push(`sub-components: ${atomicInfo.subComponents.join(", ")}`);
  }
  lines.push("");
  return lines.join("\n");
}

// ── Profile Context Rendering ──

export function renderProfileCompact(profile: PluginProfile): string {
  const lines: string[] = [];
  lines.push(`## system: ${profile.name}`);
  if (profile.layout) {
    lines.push(`layout: ${profile.layout}`);
  }
  if (Object.keys(profile.tokens).length > 0) {
    lines.push(
      `ds-tokens: ${Object.entries(profile.tokens)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")}`,
    );
  }
  if (profile.guidelines.trim()) {
    lines.push(`guidelines: ${profile.guidelines}`);
  }
  lines.push("");
  return lines.join("\n");
}
