import type { SerializedNode, SerializedPaint, ScanIssue, PluginProfile, ColorMapping } from "../../shared/types";
import { buildPath, colorToHex } from "./utils";

interface TokensResult {
  score: number;
  issues: ScanIssue[];
  colorMappings: ColorMapping[];
}

// RGB distance for fuzzy color matching (max channel diff)
const FUZZY_COLOR_THRESHOLD = 5; // allow ±5 per channel

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "");
  if (m.length !== 6) return null;
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

function colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

interface ProfileColorEntry {
  name: string;
  rgb: { r: number; g: number; b: number };
}

/** Pre-parsed profile colors for fast lookup. Built once per scan, reused for all colors. */
interface ProfileColorIndex {
  exactMap: Map<string, string>; // hex → token name (exact match)
  entries: ProfileColorEntry[];  // pre-parsed RGB for fuzzy matching
}

function buildProfileColorIndex(profileHexToName: Map<string, string>): ProfileColorIndex {
  const exactMap = new Map<string, string>();
  const entries: ProfileColorEntry[] = [];
  for (const [hex, name] of profileHexToName) {
    exactMap.set(hex, name);
    const rgb = parseHex(hex);
    if (rgb) entries.push({ name, rgb });
  }
  return { exactMap, entries };
}

function findClosestToken(hex: string, index: ProfileColorIndex): string | null {
  // Exact match first (O(1))
  const exact = index.exactMap.get(hex.toLowerCase());
  if (exact) return exact;

  // Fuzzy match against pre-parsed RGB entries
  const target = parseHex(hex);
  if (!target) return null;

  let bestName: string | null = null;
  let bestDist = Infinity;

  for (const entry of index.entries) {
    const dist = colorDistance(target, entry.rgb);
    if (dist <= FUZZY_COLOR_THRESHOLD && dist < bestDist) {
      bestDist = dist;
      bestName = entry.name;
      if (dist === 0) break; // perfect match, stop early
    }
  }

  return bestName;
}

interface ColorEntry {
  count: number;
  bound: number;
  unbound: number;
  nodes: { id: string; name: string; path: string; bound: boolean; variableName?: string }[];
}

interface WalkState {
  colors: Map<string, ColorEntry>;
  fontSizes: Map<number, { count: number; nodes: { id: string; name: string; path: string }[] }>;
  spacingValues: Set<number>;
  totalFills: number;
  boundFills: number;
  issues: ScanIssue[];
}

function walkTree(node: SerializedNode, ancestors: string[], state: WalkState) {
  const path = buildPath(ancestors, node.name);

  // Collect colors from fills and strokes — track bound vs unbound
  const paintSources: { paints: SerializedPaint[]; kind: "fill" | "stroke" }[] = [];
  if (node.fills) paintSources.push({ paints: node.fills, kind: "fill" });
  if (node.strokes) paintSources.push({ paints: node.strokes, kind: "stroke" });

  for (const { paints } of paintSources) {
    for (const paint of paints) {
      if (paint.type === "SOLID" && paint.color) {
        state.totalFills++;
        const isBound = paint.boundToVariable === true;
        if (isBound) state.boundFills++;

        const hex = colorToHex(paint.color);
        const entry = state.colors.get(hex) ?? { count: 0, bound: 0, unbound: 0, nodes: [] };
        entry.count++;
        if (isBound) entry.bound++;
        else entry.unbound++;
        entry.nodes.push({ id: node.id, name: node.name, path, bound: isBound, variableName: paint.variableName });
        state.colors.set(hex, entry);
      }
    }
  }

  // Collect font sizes
  if (node.type === "TEXT" && node.fontSize && typeof node.fontSize === "number") {
    const entry = state.fontSizes.get(node.fontSize) ?? { count: 0, nodes: [] };
    entry.count++;
    entry.nodes.push({ id: node.id, name: node.name, path });
    state.fontSizes.set(node.fontSize, entry);
  }

  // Collect spacing values
  if (node.itemSpacing !== undefined && node.itemSpacing > 0) state.spacingValues.add(node.itemSpacing);
  if (node.paddingTop !== undefined && node.paddingTop > 0) state.spacingValues.add(node.paddingTop);
  if (node.paddingRight !== undefined && node.paddingRight > 0) state.spacingValues.add(node.paddingRight);
  if (node.paddingBottom !== undefined && node.paddingBottom > 0) state.spacingValues.add(node.paddingBottom);
  if (node.paddingLeft !== undefined && node.paddingLeft > 0) state.spacingValues.add(node.paddingLeft);

  if (node.children) {
    ancestors.push(node.name);
    for (const child of node.children) {
      walkTree(child, ancestors, state);
    }
    ancestors.pop();
  }
}

export function scoreTokens(node: SerializedNode, profile?: PluginProfile | null): TokensResult {
  const state: WalkState = {
    colors: new Map(),
    fontSizes: new Map(),
    spacingValues: new Set(),
    totalFills: 0,
    boundFills: 0,
    issues: [],
  };

  walkTree(node, [], state);

  let score = 70; // base

  const uniqueColors = state.colors.size;
  const uniqueFontSizes = state.fontSizes.size;
  const spacingArray = Array.from(state.spacingValues).sort((a, b) => a - b);

  // Build profile color index (pre-parse RGB once, reuse for all color lookups)
  const profileHexToName = new Map<string, string>();
  if (profile && profile.tokens) {
    for (const [name, value] of Object.entries(profile.tokens)) {
      const match = value.match(/#[0-9A-Fa-f]{3,8}/);
      if (match) profileHexToName.set(match[0].toLowerCase(), name);
    }
  }
  const profileColorIndex = buildProfileColorIndex(profileHexToName);
  const hasProfile = profileHexToName.size > 0;
  const colorMappings: ColorMapping[] = [];

  // ── Primary check: bound vs unbound fills ──
  if (state.totalFills > 0) {
    const boundRatio = state.boundFills / state.totalFills;

    if (boundRatio >= 0.9) {
      score += 15;
    } else if (boundRatio >= 0.5) {
      score += 5;
    } else if (boundRatio === 0 && state.totalFills > 2) {
      score -= hasProfile ? 5 : 10; // less penalty with profile (AI has the map)
    }

    const unboundColors = Array.from(state.colors.entries()).filter(([, entry]) => entry.unbound > 0);

    if (hasProfile) {
      // ── Profile-aware mode: split into mapped vs unknown ──
      const unknownColors: [string, ColorEntry][] = [];

      for (const [hex, entry] of unboundColors) {
        const tokenName = findClosestToken(hex, profileColorIndex);
        colorMappings.push({ hex, tokenName, count: entry.count, nodeId: entry.nodes[0]?.id });
        if (!tokenName) {
          unknownColors.push([hex, entry]);
        }
      }

      // Also add bound colors to mappings (they're already tokenized in Figma)
      const boundColors = Array.from(state.colors.entries()).filter(([, entry]) => entry.bound > 0);
      const mappedHexes = new Set(colorMappings.map((m) => m.hex.toLowerCase()));
      for (const [hex, entry] of boundColors) {
        // Don't duplicate if already in mappings
        if (!mappedHexes.has(hex.toLowerCase())) {
          const boundNode = entry.nodes.find((n) => n.bound);
          const tokenName = boundNode?.variableName ?? findClosestToken(hex, profileColorIndex);
          colorMappings.push({ hex, tokenName, count: entry.bound, nodeId: boundNode?.id });
          mappedHexes.add(hex.toLowerCase());
        }
      }

      // Sort: mapped first, then unknown
      colorMappings.sort((a, b) => {
        if (a.tokenName && !b.tokenName) return -1;
        if (!a.tokenName && b.tokenName) return 1;
        return b.count - a.count;
      });

      // Unknown colors: individual warnings — these are the real problems
      for (const [hex, entry] of unknownColors) {
        const unboundNodes = entry.nodes.filter((n) => !n.bound);
        const nodeNames = unboundNodes
          .slice(0, 3)
          .map((n) => `"${n.name}"`)
          .join(", ");
        const extra = unboundNodes.length > 3 ? ` +${unboundNodes.length - 3} more` : "";
        state.issues.push({
          id: `tokens-unknown-color-${hex}`,
          category: "tokens",
          severity: "warning",
          message: `Color ${hex} on ${nodeNames}${extra} doesn't match any token in "${profile!.name}". AI will hardcode this value.`,
          path: node.name,
          suggestion: `Add this color to your profile tokens, or bind it to a Figma Variable.`,
        });
      }

      // Boost score if most colors are mapped
      const totalUnbound = unboundColors.length;
      const mappedCount = colorMappings.filter((m) => m.tokenName).length;
      if (totalUnbound > 0) {
        const mappedRatio = mappedCount / (mappedCount + totalUnbound);
        if (mappedRatio >= 0.9) score += 10;
        else if (mappedRatio >= 0.5) score += 5;
      }
    } else {
      // ── No profile: build color mappings from all colors ──
      for (const [hex, entry] of state.colors.entries()) {
        const boundNode = entry.nodes.find((n) => n.bound && n.variableName);
        colorMappings.push({
          hex,
          tokenName: boundNode?.variableName ?? null,
          count: entry.count,
          nodeId: entry.nodes[0]?.id,
        });
      }
      colorMappings.sort((a, b) => b.count - a.count);
    }
  }

  // ── Secondary: color palette consistency (fallback when boundVariables not available) ──
  if (state.totalFills > 0 && state.boundFills === 0 && !hasProfile) {
    // No boundVariable data and no profile — fall back to heuristic
    if (uniqueColors > 10) {
      score -= 10;
      state.issues.push({
        id: "tokens-too-many-colors",
        category: "tokens",
        severity: "warning",
        message: `${uniqueColors} unique colors found. This suggests hardcoded values instead of design tokens.`,
        path: node.name,
        suggestion: "Consolidate colors into Figma Styles or Variables. AI maps tokens to CSS custom properties.",
      });
    } else if (uniqueColors > 0 && uniqueColors <= 4) {
      score += 5;
    }
  }

  // Font size consistency
  if (uniqueFontSizes > 6) {
    score -= 10;
    state.issues.push({
      id: "tokens-too-many-fontsizes",
      category: "tokens",
      severity: "warning",
      message: `${uniqueFontSizes} different font sizes used. A consistent type scale typically has 4-6 sizes.`,
      path: node.name,
      suggestion: "Define font sizes as Figma Text Styles. AI will map these to a clean typographic scale.",
    });
  } else if (uniqueFontSizes >= 2 && uniqueFontSizes <= 5) {
    score += 10;
  }

  // Spacing consistency
  if (spacingArray.length > 0) {
    const on4pxGrid = spacingArray.every((v) => v % 4 === 0);
    const on8pxGrid = spacingArray.every((v) => v % 8 === 0);

    if (on8pxGrid) {
      score += 10;
    } else if (on4pxGrid) {
      score += 5;
    } else {
      const oddValues = spacingArray.filter((v) => v % 4 !== 0);
      if (oddValues.length > 2) {
        score -= 5;
        state.issues.push({
          id: "tokens-irregular-spacing",
          category: "tokens",
          severity: "info",
          message: `Spacing values ${oddValues.join(", ")}px are not on a 4px grid. Irregular spacing makes AI-generated code inconsistent.`,
          path: node.name,
          suggestion: "Align spacing to a 4px or 8px grid for consistent, tokenizable spacing.",
        });
      }
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues: state.issues,
    colorMappings,
  };
}
