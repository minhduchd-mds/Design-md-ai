/**
 * project-frame/primitives — Low-level Figma node builders.
 *
 * Creates text labels, pills, status dots, component cards,
 * placeholders, sections, rows, and empty states.
 */

import type { DesignSystemComponentInfo } from "../../../shared/types";
import { CARD_WIDTH, CARD_HEIGHT, COLORS } from "./constants";
import { loadInstanceFonts } from "./fonts";

// ── Text primitives ──

export function applyText(node: TextNode, text: string, font: FontName, size: number, color: RGB) {
  node.fontName = font;
  node.fontSize = size;
  node.fills = [{ type: "SOLID", color }];
  node.characters = text;
}

export function createLabel(text: string, font: FontName, size: number, color: RGB, maxWidth?: number): TextNode {
  const label = figma.createText();
  applyText(label, text, font, size, color);
  label.textAutoResize = "HEIGHT";
  if (maxWidth) label.resize(maxWidth, label.height);
  return label;
}

export function createPill(text: string, font: FontName): FrameNode {
  const pill = figma.createFrame();
  pill.name = `Tag / ${text}`;
  pill.layoutMode = "HORIZONTAL";
  pill.primaryAxisSizingMode = "AUTO";
  pill.counterAxisSizingMode = "AUTO";
  pill.primaryAxisAlignItems = "CENTER";
  pill.counterAxisAlignItems = "CENTER";
  pill.paddingLeft = 12;
  pill.paddingRight = 12;
  pill.paddingTop = 6;
  pill.paddingBottom = 6;
  pill.cornerRadius = 999;
  pill.fills = [{ type: "SOLID", color: COLORS.tagBg }];
  pill.strokes = [{ type: "SOLID", color: COLORS.tagStroke }];
  pill.strokeWeight = 1;

  const label = createLabel(text, font, 11, COLORS.tag);
  label.textAutoResize = "WIDTH_AND_HEIGHT";
  pill.appendChild(label);
  return pill;
}

export function createStatusDot(color: RGB): FrameNode {
  const dot = figma.createFrame();
  dot.name = "Status dot";
  dot.resize(8, 8);
  dot.cornerRadius = 4;
  dot.fills = [{ type: "SOLID", color }];
  return dot;
}

// ── Component preview & placeholder ──

export function createPlaceholder(component: DesignSystemComponentInfo, regularFont: FontName, semiBoldFont: FontName): FrameNode {
  const card = figma.createFrame();
  card.name = `Placeholder / ${component.name}`;
  card.layoutMode = "VERTICAL";
  card.primaryAxisSizingMode = "AUTO";
  card.counterAxisSizingMode = "FIXED";
  card.itemSpacing = 8;
  card.paddingLeft = 16;
  card.paddingRight = 16;
  card.paddingTop = 14;
  card.paddingBottom = 14;
  card.resize(CARD_WIDTH, 10);
  card.cornerRadius = 10;
  card.fills = [{ type: "SOLID", color: COLORS.white }];
  card.strokes = [{ type: "SOLID", color: COLORS.borderL }];
  card.strokeWeight = 1;

  const topRow = figma.createFrame();
  topRow.name = "Top row";
  topRow.layoutMode = "HORIZONTAL";
  topRow.primaryAxisSizingMode = "AUTO";
  topRow.counterAxisSizingMode = "AUTO";
  topRow.counterAxisAlignItems = "CENTER";
  topRow.itemSpacing = 6;
  topRow.fills = [];
  topRow.appendChild(createStatusDot(component.source === "suggested" ? COLORS.placeholder : COLORS.accent));
  const typeBadge = createLabel(
    component.source === "suggested" ? "Suggested" : component.type === "COMPONENT_SET" ? "Component Set" : "Component",
    regularFont, 10, COLORS.meta,
  );
  typeBadge.textAutoResize = "WIDTH_AND_HEIGHT";
  topRow.appendChild(typeBadge);
  card.appendChild(topRow);

  const name = createLabel(component.name, semiBoldFont, 14, COLORS.heading, CARD_WIDTH - 32);
  card.appendChild(name);

  const pageLine = createLabel(`Page: ${component.pageName}`, regularFont, 11, COLORS.body, CARD_WIDTH - 32);
  card.appendChild(pageLine);

  if (component.role && component.role !== "unknown") {
    const roleLine = createLabel(`Role: ${component.role}`, regularFont, 11, COLORS.body, CARD_WIDTH - 32);
    card.appendChild(roleLine);
  }

  if (component.variantProperties) {
    const vCount = Object.keys(component.variantProperties).length;
    if (vCount > 0) {
      const vLine = createLabel(`${vCount} variant properties`, regularFont, 10, COLORS.meta, CARD_WIDTH - 32);
      card.appendChild(vLine);
    }
  }

  return card;
}

function isSceneNode(node: BaseNode | null): node is SceneNode {
  return !!node && "type" in node && node.type !== "DOCUMENT" && node.type !== "PAGE";
}

function isComponentLike(node: SceneNode): node is ComponentNode | ComponentSetNode {
  return node.type === "COMPONENT" || node.type === "COMPONENT_SET";
}

function findDefaultVariant(componentSet: ComponentSetNode): ComponentNode | null {
  const components = componentSet.children.filter((c): c is ComponentNode => c.type === "COMPONENT");
  if (components.length === 0) return null;
  return (
    components.find(c => {
      const values = Object.values(c.variantProperties ?? {}).map(v => v.toLowerCase());
      return values.includes("default");
    }) ?? components[0]
  );
}

export async function createComponentPreview(component: DesignSystemComponentInfo): Promise<SceneNode | null> {
  if (component.source === "suggested") return null;

  const nodeId = component.nodeId ?? (component.source === "library" ? undefined : component.id);
  const componentKey = component.componentKey ?? (component.source === "library" ? component.id : undefined);

  let sourceNode: ComponentNode | ComponentSetNode | null = null;

  if (nodeId) {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (isSceneNode(node) && isComponentLike(node)) sourceNode = node;
    } catch { /* node not available */ }
  }

  if (!sourceNode && componentKey) {
    try {
      sourceNode = component.type === "COMPONENT_SET"
        ? await figma.importComponentSetByKeyAsync(componentKey)
        : await figma.importComponentByKeyAsync(componentKey);
    } catch { /* import failed */ }
  }

  if (!sourceNode) return null;

  const source = sourceNode.type === "COMPONENT_SET" ? findDefaultVariant(sourceNode) : sourceNode;
  if (!source) return null;

  try {
    const instance = source.createInstance();
    instance.name = `Instance / ${component.name}`;
    await loadInstanceFonts(instance);
    const maxW = CARD_WIDTH;
    const maxH = CARD_HEIGHT;
    const scale = Math.min(1, maxW / Math.max(1, instance.width), maxH / Math.max(1, instance.height));
    if (scale < 1) instance.rescale(scale);
    return instance;
  } catch {
    return null;
  }
}

export function createInstanceCard(instance: SceneNode, name: string, semiBoldFont: FontName): FrameNode {
  const card = figma.createFrame();
  card.name = `Card / ${name}`;
  card.layoutMode = "VERTICAL";
  card.primaryAxisSizingMode = "AUTO";
  card.counterAxisSizingMode = "FIXED";
  card.counterAxisAlignItems = "CENTER";
  card.itemSpacing = 8;
  card.paddingLeft = 12;
  card.paddingRight = 12;
  card.paddingTop = 12;
  card.paddingBottom = 10;
  card.resize(CARD_WIDTH, 10);
  card.cornerRadius = 10;
  card.fills = [{ type: "SOLID", color: COLORS.white }];
  card.strokes = [{ type: "SOLID", color: COLORS.borderL }];
  card.strokeWeight = 1;

  const previewFrame = figma.createFrame();
  previewFrame.name = "Preview";
  previewFrame.resize(Math.min(CARD_WIDTH - 24, instance.width), Math.min(CARD_HEIGHT - 40, instance.height));
  previewFrame.fills = [];
  previewFrame.clipsContent = true;
  previewFrame.appendChild(instance);
  card.appendChild(previewFrame);

  const label = createLabel(name, semiBoldFont, 11, COLORS.heading, CARD_WIDTH - 24);
  label.textTruncation = "ENDING";
  label.textAutoResize = "HEIGHT";
  card.appendChild(label);

  return card;
}

// ── Section builders ──

export function createSection(title: string, regularFont: FontName, semiBoldFont: FontName, width: number): FrameNode {
  const section = figma.createFrame();
  section.name = `Section / ${title}`;
  section.layoutMode = "VERTICAL";
  section.primaryAxisSizingMode = "AUTO";
  section.counterAxisSizingMode = "FIXED";
  section.itemSpacing = 20;
  section.paddingLeft = 24;
  section.paddingRight = 24;
  section.paddingTop = 24;
  section.paddingBottom = 24;
  section.resize(width, 10);
  section.cornerRadius = 16;
  section.fills = [{ type: "SOLID", color: COLORS.white }];
  section.strokes = [{ type: "SOLID", color: COLORS.border }];
  section.strokeWeight = 1;

  const label = createLabel(title, semiBoldFont, 20, COLORS.heading, width - 48);
  section.appendChild(label);

  return section;
}

export function createRow(name: string, width: number): FrameNode {
  const row = figma.createFrame();
  row.name = name;
  row.layoutMode = "HORIZONTAL";
  row.layoutWrap = "WRAP";
  row.primaryAxisSizingMode = "FIXED";
  row.counterAxisSizingMode = "AUTO";
  row.itemSpacing = 14;
  row.counterAxisSpacing = 14;
  row.resize(width, 10);
  row.fills = [];
  return row;
}

export function createEmptyState(text: string, font: FontName, width: number): FrameNode {
  const frame = figma.createFrame();
  frame.name = "Empty state";
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.primaryAxisAlignItems = "CENTER";
  frame.counterAxisAlignItems = "CENTER";
  frame.paddingTop = 32;
  frame.paddingBottom = 32;
  frame.resize(width, 10);
  frame.cornerRadius = 10;
  frame.fills = [{ type: "SOLID", color: COLORS.emptyBg }];
  frame.strokes = [{ type: "SOLID", color: COLORS.borderL }];
  frame.strokeWeight = 1;
  frame.dashPattern = [6, 4];

  const label = createLabel(text, font, 12, COLORS.empty);
  label.textAutoResize = "WIDTH_AND_HEIGHT";
  frame.appendChild(label);
  return frame;
}
