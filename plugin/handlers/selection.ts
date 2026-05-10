import { serializeNode } from "../serializer";
import type { PluginMessage, ViewportVariant } from "../../shared/types";
import { detectViewport } from "../../shared/viewport";

export async function sendSelection(): Promise<void> {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    const msg: PluginMessage = { type: "no-selection" };
    figma.ui.postMessage(msg);
    return;
  }

  let node = selection[0];
  let resolvedFromSet = false;

  // ComponentSet selected → resolve to Default variant
  if (node.type === "COMPONENT_SET") {
    const defaultVariant = findDefaultVariant(node as ComponentSetNode);
    if (defaultVariant) {
      resolvedFromSet = true;
      node = defaultVariant;
    }
  }

  const serialized = await serializeNode(node);
  const msg: PluginMessage = {
    type: "selection-change",
    node: serialized,
    name: resolvedFromSet ? selection[0].name : node.name,
    selectionCount: selection.length,
    resolvedFromComponentSet: resolvedFromSet,
    componentSetName: resolvedFromSet ? selection[0].name : undefined,
  };
  figma.ui.postMessage(msg);
}

function findDefaultVariant(componentSet: ComponentSetNode): ComponentNode | null {
  const children = componentSet.children as ComponentNode[];
  if (children.length === 0) return null;

  // Try to find a variant with "Default" in its properties
  for (const child of children) {
    if (child.type !== "COMPONENT") continue;
    const props = child.variantProperties;
    if (!props) continue;
    const values = Object.values(props).map((v) => v.toLowerCase());
    if (values.includes("default")) return child;
  }

  // Fallback: first child component
  const first = children.find((c) => c.type === "COMPONENT");
  return first ?? null;
}

// Breakpoint labels commonly used in design systems (Tailwind/Bootstrap + full words).
// Single-letter tokens (s/m/l) are deliberately excluded — too many false positives.
const VIEWPORT_SUFFIXES = "xs|sm|md|lg|xl|xxl|2xl|3xl|mobile|tablet|desktop|phone|laptop";

// Explicit allowlist of common Figma frame widths (iOS, iPad, common desktop presets).
// Only these numeric suffixes strip — arbitrary numbers like `Icon-v2-512` are left alone.
const VIEWPORT_WIDTHS = "320|360|375|390|414|428|480|540|640|768|820|834|1024|1194|1280|1366|1440|1536|1920|2560";

const VIEWPORT_TOKEN = `${VIEWPORT_SUFFIXES}|${VIEWPORT_WIDTHS}`;

export function extractBaseName(name: string): string {
  return name
    .replace(new RegExp(`\\s*[/\\-_]\\s*(${VIEWPORT_TOKEN})\\s*$`, "i"), "")
    .replace(new RegExp(`\\s*\\(\\s*(${VIEWPORT_TOKEN})\\s*\\)\\s*$`, "i"), "")
    .trim();
}

async function findVariants(selectedNode: SceneNode, resolvedNode?: SceneNode): Promise<ViewportVariant[]> {
  const page = figma.currentPage;
  const baseName = extractBaseName(selectedNode.name);
  const variants: ViewportVariant[] = [];

  for (const child of page.children) {
    if (child.type !== "FRAME" && child.type !== "COMPONENT" && child.type !== "COMPONENT_SET") continue;
    if (child.id === selectedNode.id) continue;

    const childBase = extractBaseName(child.name);
    if (childBase.toLowerCase() !== baseName.toLowerCase()) continue;

    // For sibling ComponentSets, resolve to their default variant for dimensions
    const siblingResolved = child.type === "COMPONENT_SET"
      ? findDefaultVariant(child as ComponentSetNode) ?? child
      : child;

    variants.push({
      nodeId: child.id,
      name: child.name,
      width: Math.round(siblingResolved.width),
      height: Math.round(siblingResolved.height),
      viewportType: detectViewport(siblingResolved.width),
      node: await serializeNode(siblingResolved),
    });
  }

  // Current selection: use resolved dimensions if available
  const current = resolvedNode ?? selectedNode;
  variants.unshift({
    nodeId: selectedNode.id,
    name: selectedNode.name,
    width: Math.round(current.width),
    height: Math.round(current.height),
    viewportType: detectViewport(current.width),
  });

  return variants;
}

function resolveNode(node: SceneNode): SceneNode {
  if (node.type === "COMPONENT_SET") {
    return findDefaultVariant(node as ComponentSetNode) ?? node;
  }
  return node;
}

async function sendBatchSelection(): Promise<void> {
  const selection = figma.currentPage.selection;
  const nodes = await Promise.all(selection.map((node) => serializeNode(resolveNode(node))));
  const msg: PluginMessage = { type: "batch-selection-result", nodes };
  figma.ui.postMessage(msg);
}

export async function handleSelectionMessage(msg: PluginMessage): Promise<boolean> {
  switch (msg.type) {
    case "request-selection":
      await sendSelection();
      return true;
    case "request-batch-selection":
      await sendBatchSelection();
      return true;
    case "request-variants": {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) return true;
      const original = selection[0];
      const resolved = resolveNode(original);
      // Use original for sibling matching (page-level), resolved for dimensions
      const variants = await findVariants(original, resolved !== original ? resolved : undefined);
      const response: PluginMessage = { type: "variants-result", variants };
      figma.ui.postMessage(response);
      return true;
    }
    case "resize":
      figma.ui.resize(Math.max(320, Math.round(msg.width)), Math.max(400, Math.round(msg.height)));
      return true;
    case "select-node": {
      const target = await figma.getNodeByIdAsync(msg.nodeId);
      if (target && "type" in target && target.type !== "DOCUMENT" && target.type !== "PAGE") {
        const sceneNode = target as SceneNode;
        figma.currentPage.selection = [sceneNode];
        figma.viewport.scrollAndZoomIntoView([sceneNode]);
        if (msg.notify) {
          figma.notify(msg.notify, { timeout: 4000 });
        }
      }
      return true;
    }
    default:
      return false;
  }
}
