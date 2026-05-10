import type { SerializedNode, PluginProfile } from "../../shared/types";
import { detectViewport } from "../../shared/viewport";
import { sanitizeName, sanitizeText } from "./sanitize";
import { colorToHex } from "./utils";
import {
  type PromptOptions,
  isDivider,
  isIconFrame,
  collectTokens,
  renderAtomicCompact,
  renderProfileCompact,
} from "./prompt-shared";

export type { PromptOptions };

// ── Compact tree notation ──

function compactNode(node: SerializedNode, depth: number, maxDepth: number): string {
  if (depth > maxDepth) return "";
  if (node.visible === false) return "";

  const ind = "  ".repeat(depth);

  // Detect dividers early
  if (isDivider(node)) {
    const fill = node.fills?.find((f) => f.type === "SOLID" && f.color);
    const color = fill?.color ? ` ${colorToHex(fill.color)}` : "";
    const w = node.width ?? 0;
    return `${ind}@${sanitizeName(node.name)} [divider]${color} ${w}px`;
  }

  // Detect icon frames: all children are shapes → render as single icon node, skip children
  if (isIconFrame(node)) {
    return `${ind}@${sanitizeName(node.name)} [icon] ${node.width ?? 0}×${node.height ?? 0} aria-hidden`;
  }

  const parts: string[] = [];

  // @name TYPE
  parts.push(`@${sanitizeName(node.name)}`);

  const typeMap: Record<string, string> = {
    FRAME: "F",
    GROUP: "G",
    TEXT: "T",
    RECTANGLE: "R",
    ELLIPSE: "E",
    INSTANCE: "I",
    COMPONENT: "C",
    COMPONENT_SET: "CS",
    VECTOR: "V",
    LINE: "L",
  };
  parts.push(typeMap[node.type] ?? node.type);

  // Dimensions
  if (node.width && node.height) {
    parts.push(`${node.width}×${node.height}`);
  }

  // Layout
  if (node.layoutMode) {
    const dir = node.layoutMode === "HORIZONTAL" ? "H" : "V";
    let layout = dir;
    if (node.itemSpacing) layout += ` gap:${node.itemSpacing}`;
    if (node.paddingTop !== undefined || node.paddingLeft !== undefined) {
      const t = node.paddingTop ?? 0;
      const r = node.paddingRight ?? 0;
      const b = node.paddingBottom ?? 0;
      const l = node.paddingLeft ?? 0;
      if (t === r && r === b && b === l) {
        layout += ` pad:${t}`;
      } else if (t === b && l === r) {
        layout += ` pad:${t},${l}`;
      } else {
        layout += ` pad:${t},${r},${b},${l}`;
      }
    }
    parts.push(layout);
  }

  // Grid
  if (node.layoutGrids && node.layoutGrids.length > 0) {
    for (const grid of node.layoutGrids) {
      if (grid.pattern === "COLUMNS") {
        let g = `grid:${grid.count}col`;
        if (grid.gutterSize) g += `/${grid.gutterSize}g`;
        if (grid.offset) g += `/${grid.offset}m`;
        parts.push(g);
      }
    }
  }

  // Clip (overflow hidden)
  if (node.clipsContent) {
    parts.push("clip");
  }

  // Min/Max constraints
  const sizeConstraints: string[] = [];
  if (node.minWidth) sizeConstraints.push(`min-w:${node.minWidth}`);
  if (node.maxWidth) sizeConstraints.push(`max-w:${node.maxWidth}`);
  if (node.minHeight) sizeConstraints.push(`min-h:${node.minHeight}`);
  if (node.maxHeight) sizeConstraints.push(`max-h:${node.maxHeight}`);
  if (sizeConstraints.length) parts.push(sizeConstraints.join(" "));

  // Fill (solid, gradient, image)
  if (node.fills && node.fills.length > 0) {
    const solid = node.fills.find((f) => f.type === "SOLID" && f.color);
    if (solid && solid.color) {
      parts.push(`fill:${colorToHex(solid.color)}`);
    }
    const gradient = node.fills.find((f) => f.gradientStops && f.gradientStops.length >= 2);
    if (gradient && gradient.gradientStops) {
      const stops = gradient.gradientStops;
      const start = `#${stops[0].color.r.toString(16).padStart(2, "0")}${stops[0].color.g.toString(16).padStart(2, "0")}${stops[0].color.b.toString(16).padStart(2, "0")}`;
      const end = `#${stops[stops.length - 1].color.r.toString(16).padStart(2, "0")}${stops[stops.length - 1].color.g.toString(16).padStart(2, "0")}${stops[stops.length - 1].color.b.toString(16).padStart(2, "0")}`;
      const type = gradient.type === "GRADIENT_RADIAL" ? "radial" : "linear";
      const angle = gradient.gradientAngle !== undefined ? `${gradient.gradientAngle}deg,` : "";
      parts.push(`fill:${type}(${angle}${start}→${end})`);
    }
    if (node.fills.some((f) => f.type === "IMAGE")) {
      parts.push("fill:img");
    }
  }

  // Constraints
  if (node.constraints) {
    const h = node.constraints.horizontal;
    const v = node.constraints.vertical;
    const hints: string[] = [];
    if (h === "STRETCH") hints.push("stretch-h");
    if (h === "CENTER") hints.push("center-h");
    if (h === "SCALE") hints.push("scale-h");
    if (v === "STRETCH") hints.push("stretch-v");
    if (v === "CENTER") hints.push("center-v");
    if (v === "SCALE") hints.push("scale-v");
    if (hints.length > 0) parts.push(hints.join(","));
  }

  // Stroke/border
  if (node.strokes && node.strokes.length > 0) {
    const solid = node.strokes.find((s) => s.type === "SOLID" && s.color);
    if (solid && solid.color) {
      let borderStr = `border:${colorToHex(solid.color)}`;
      if (node.strokeWeight) borderStr += `,${node.strokeWeight}px`;
      if (node.strokeAlign && node.strokeAlign !== "CENTER") borderStr += `,${node.strokeAlign.toLowerCase()}`;
      parts.push(borderStr);
    }
  }

  // Text content
  if (node.type === "TEXT" && node.characters) {
    const text = sanitizeText(node.characters);
    parts.push(`"${text}"`);
    if (node.fontSize) {
      let font = `${node.fontSize}`;
      if (node.fontWeight) font += `/w${node.fontWeight}`;
      else if (node.fontName) font += `/${node.fontName.style}`;
      if (node.lineHeight) font += `/lh:${node.lineHeight}`;
      if (node.letterSpacing) font += `/ls:${node.letterSpacing}`;
      parts.push(font);
      if (node.textAlignHorizontal && node.textAlignHorizontal !== "LEFT") parts.push(`align:${node.textAlignHorizontal.toLowerCase()}`);
      if (node.textDecoration) parts.push(node.textDecoration.toLowerCase());
      if (node.textCase && node.textCase !== "ORIGINAL") parts.push(node.textCase.toLowerCase());
    }
    // Text truncation
    if (node.textTruncation === "ENDING" || node.maxLines) {
      parts.push(node.maxLines ? `truncate:${node.maxLines}lines` : "ellipsis");
    }
  }

  // Corner radius
  if (node.cornerRadius && node.cornerRadius !== 0) {
    parts.push(`r:${node.cornerRadius}`);
  }

  // Opacity + effects
  if (node.opacity !== undefined && node.opacity < 1) {
    parts.push(`opacity:${node.opacity}`);
  }
  if (node.effects && node.effects.length > 0) {
    for (const e of node.effects) {
      if (e.type === "DROP_SHADOW" && e.offset) parts.push(`shadow:${e.offset.x},${e.offset.y},${e.radius ?? 0}`);
      else if (e.type === "LAYER_BLUR") parts.push(`blur:${e.radius}`);
      else if (e.type === "BACKGROUND_BLUR") parts.push(`backdrop-blur:${e.radius}`);
    }
  }

  // Component instance
  if (node.isInstance && node.componentName) {
    const variants = node.variantProperties;
    if (variants && Object.keys(variants).length > 0) {
      const varStr = Object.values(variants).join(",");
      parts.push(`${node.componentName}{${varStr}}`);
    } else {
      parts.push(`<${node.componentName}>`);
    }

    // All property definitions (VARIANT + BOOLEAN + TEXT + INSTANCE_SWAP)
    if (node.componentPropertyDefinitions && node.componentPropertyDefinitions.length > 0) {
      const propParts = node.componentPropertyDefinitions.map((d) => {
        const t = d.type === "INSTANCE_SWAP" ? "swap" : d.type.toLowerCase();
        if (d.type === "VARIANT" && d.values) return `${t}:${d.name}[${d.values.join("|")}]`;
        return `${t}:${d.name}`;
      });
      parts.push(`props(${propParts.join(" ")})`);
    } else if (node.availableVariants) {
      const avail = Object.entries(node.availableVariants)
        .map(([k, v]) => `${k}:[${v.join("|")}]`)
        .join(" ");
      parts.push(`variants(${avail})`);
    }
  }

  if (node.isComponent) {
    parts.push("[component]");
  }

  // Component description (behaviour context)
  if (node.componentDescription) {
    parts.push(`desc:"${sanitizeText(node.componentDescription)}"`);
  }

  const line = `${ind}${parts.join(" ")}`;
  const lines = [line];

  // Children
  if (node.children && depth < maxDepth) {
    for (const child of node.children) {
      const childLine = compactNode(child, depth + 1, maxDepth);
      if (childLine) lines.push(childLine);
    }
  }

  return lines.join("\n");
}

// ── Main Export ──

export function generateCompactPrompt(node: SerializedNode, options: PromptOptions = {}): string {
  const lines: string[] = [];
  const stack = options.profile?.stack ?? options.techStack ?? "React+TS+CSS";

  // Header
  lines.push(`# ${sanitizeName(node.name)} → ${stack}`);
  lines.push(`# DesignReady.ai compact spec — reconstruct this component from the spec tree`);
  lines.push("");

  // Profile context (v1)
  if (options.profile) {
    lines.push(renderProfileCompact(options.profile));
  }

  // Tokens block (compact)
  const { colors, fonts, spacing } = collectTokens(node);

  if (colors.size > 0 || fonts.size > 0 || spacing.length > 0) {
    lines.push("## tokens");
    if (colors.size > 0) {
      lines.push(
        `colors: ${Array.from(colors.entries())
          .map(([c, nodes]) => `${c}(${nodes.length})`)
          .join(" ")}`,
      );
    }
    if (fonts.size > 0) {
      lines.push(
        `fonts: ${Array.from(fonts.entries())
          .map(([f, n]) => `${f}(${n})`)
          .join(" ")}`,
      );
    }
    if (spacing.length > 0) {
      lines.push(`spacing: ${spacing.join(",")}`);
    }
    lines.push("");
  }

  // Viewport
  const vp = detectViewport(node.width ?? 0);
  lines.push(`## viewport: ${vp} ${node.width}×${node.height}`);

  // Multi-variant
  if (options.variants && options.variants.length > 1) {
    const others = options.variants.filter((v) => v.nodeId !== node.id);
    if (others.length > 0) {
      lines.push(`also: ${others.map((v) => `${detectViewport(v.width)} ${v.width}×${v.height}`).join(", ")}`);
    }
  }
  lines.push("");

  // Main tree
  lines.push("## tree");
  lines.push(compactNode(node, 0, 12));
  lines.push("");

  // Variant trees
  if (options.variants && options.variants.length > 1) {
    for (const v of options.variants) {
      if (!v.node || v.nodeId === node.id) continue;
      lines.push(`## tree:${detectViewport(v.width)} ${v.width}px`);
      lines.push(compactNode(v.node, 0, 12));
      lines.push("");
    }
  }

  // Atomic level
  if (options.atomicInfo) {
    lines.push(renderAtomicCompact(options.atomicInfo));
  }


  // Compact instructions
  lines.push("## rules");
  lines.push(`stack: ${stack}`);
  lines.push("match spec fidelity — sizes, colors, spacing, typography as specified above");
  lines.push("H=flex-row V=flex-column gap/pad values in px");
  lines.push("semantic HTML, ARIA labels, CSS custom props for colors");
  lines.push('LINE/RECT≤2px/Instance"Divider" → <hr aria-hidden> with border-top, never div+bg');
  lines.push("implement all component states listed in variants()");
  lines.push("variants named hover/focus/active/disabled/pressed → implement as CSS pseudo-classes");
  if (options.profile && Object.keys(options.profile.tokens).length > 0) {
    lines.push("map detected colors/spacing to ds-tokens above via CSS custom properties");
  }
  lines.push("do not invent content or interactions not in spec");
  lines.push("");

  // Self-check
  lines.push("## self-check");
  lines.push("verify code against THIS spec (you have no Figma access):");
  lines.push("colors match spec hex/tokens, spacing matches spec px values");
  lines.push("font sizes+weights match, layout direction+gap match spec");
  lines.push("all components+states implemented, tokens as CSS custom props");
  lines.push("all text content exact, semantic HTML+ARIA present");
  lines.push("fix any mismatch before delivering");

  // Skill Sync — only in standalone mode (batch adds its own at the end)
  if (options.profile && !options.skipSkillSync) {
    lines.push("");
    lines.push(renderSkillSyncBlock(options.profile));
  }

  return lines.join("\n");
}

// ── Skill Sync Block ──

export function renderSkillSyncBlock(profile: PluginProfile): string {
  const slug = profile.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const lines: string[] = [];
  lines.push("# TASK 2 — Skill Sync (execute AFTER code is complete)");
  lines.push("");
  lines.push("You are NOT done until this task is completed.");
  lines.push("");
  lines.push(`system: ${profile.name}`);
  lines.push(`stack: ${profile.stack}`);
  lines.push(`suggest-path: .claude/skills/${slug}-design2code/SKILL.md`);
  lines.push("");
  lines.push("## steps");
  lines.push("1. Search ~/.claude/skills/ for existing skills matching this system name or stack");
  lines.push("2. If no matching skill → ask user whether to create one at suggest-path above");
  lines.push("3. If matching skill found → diff tokens + components against this scan:");
  lines.push("   - AUTO-UPDATE (no confirmation needed): new components, layout changes, structural details, new patterns");
  lines.push("   - CONFIRM FIRST: token value changes (color/spacing/radius), removed tokens, renamed components");
  lines.push("4. Apply updates to skill reference files");
  lines.push("5. Show summary: what was added/changed/skipped");
  lines.push("");
  lines.push("## constraints");
  lines.push("- skill SKILL.md stays under 150 lines — details in references/");
  lines.push("- tokens in references/tokens.md, components in references/components.md");
  lines.push("- preserve existing content — only add/update, never delete without confirmation");
  return lines.join("\n");
}
