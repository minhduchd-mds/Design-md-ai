/**
 * project-frame — Create a Figma project layout frame from design system data.
 *
 * Split into modules:
 *   - constants.ts        — colors, dimensions, types
 *   - fonts.ts            — font resolution & instance font loading
 *   - primitives.ts       — low-level Figma node builders
 *   - component-picker.ts — component selection & template section defs
 */

import type { DesignSystemComponentInfo, FigmaProjectFrameRequest, PluginMessage } from "../../../shared/types";
import { FRAME_WIDTH, FRAME_PADDING, CONTENT_WIDTH, COLORS, type FrameBuildState } from "./constants";
import { loadPreferredFont } from "./fonts";
import { componentPickKey, getSection, getTemplateSections } from "./component-picker";
import {
  createLabel,
  createPill,
  createSection,
  createRow,
  createEmptyState,
  createPlaceholder,
  createComponentPreview,
  createInstanceCard,
} from "./primitives";

// ── Card appender ──

async function appendComponentCards(
  container: FrameNode,
  components: DesignSystemComponentInfo[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
) {
  if (components.length === 0) {
    container.appendChild(createEmptyState("No matching components", fonts.regular, container.width - 28));
    return;
  }

  for (const component of components) {
    const preview = await createComponentPreview(component);
    if (preview) {
      state.instanceCount++;
      container.appendChild(createInstanceCard(preview, component.name, fonts.semiBold));
    } else {
      state.placeholderCount++;
      container.appendChild(createPlaceholder(component, fonts.regular, fonts.semiBold));
    }
  }
}

// ── Preview slot (inside template layouts) ──

async function createPreviewSlot(
  title: string,
  components: DesignSystemComponentInfo[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
  width: number,
): Promise<FrameNode> {
  const slot = figma.createFrame();
  slot.name = `Slot / ${title}`;
  slot.layoutMode = "VERTICAL";
  slot.primaryAxisSizingMode = "AUTO";
  slot.counterAxisSizingMode = "FIXED";
  slot.itemSpacing = 12;
  slot.paddingLeft = 14;
  slot.paddingRight = 14;
  slot.paddingTop = 14;
  slot.paddingBottom = 14;
  slot.resize(width, 10);
  slot.cornerRadius = 12;
  slot.fills = [{ type: "SOLID", color: COLORS.card }];
  slot.strokes = [{ type: "SOLID", color: COLORS.borderL }];
  slot.strokeWeight = 1;

  const headerRow = figma.createFrame();
  headerRow.name = "Slot header";
  headerRow.layoutMode = "HORIZONTAL";
  headerRow.primaryAxisSizingMode = "FIXED";
  headerRow.counterAxisSizingMode = "AUTO";
  headerRow.counterAxisAlignItems = "CENTER";
  headerRow.itemSpacing = 8;
  headerRow.resize(width - 28, 10);
  headerRow.fills = [];

  const label = createLabel(title, fonts.semiBold, 14, COLORS.heading);
  label.textAutoResize = "WIDTH_AND_HEIGHT";
  label.layoutGrow = 1;
  headerRow.appendChild(label);

  const countBadge = createLabel(`${components.length}`, fonts.regular, 11, COLORS.accent);
  countBadge.textAutoResize = "WIDTH_AND_HEIGHT";
  headerRow.appendChild(countBadge);

  slot.appendChild(headerRow);

  const row = createRow(`${title} Components`, width - 28);
  await appendComponentCards(row, components, fonts, state);
  slot.appendChild(row);
  return slot;
}

// ── Template layouts ──

async function createDashboardLayout(
  templateSections: { title: string; components: DesignSystemComponentInfo[] }[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
  width: number,
): Promise<FrameNode> {
  const shell = figma.createFrame();
  shell.name = "Dashboard / App layout";
  shell.layoutMode = "HORIZONTAL";
  shell.primaryAxisSizingMode = "FIXED";
  shell.counterAxisSizingMode = "AUTO";
  shell.itemSpacing = 16;
  shell.paddingLeft = 16;
  shell.paddingRight = 16;
  shell.paddingTop = 16;
  shell.paddingBottom = 16;
  shell.resize(width, 10);
  shell.cornerRadius = 12;
  shell.fills = [{ type: "SOLID", color: COLORS.white }];
  shell.strokes = [{ type: "SOLID", color: COLORS.border }];
  shell.strokeWeight = 1;

  const sidebarW = 280;
  const mainW = width - 32 - sidebarW - 16;

  const nav = getSection(templateSections, "Navigation and header");
  shell.appendChild(await createPreviewSlot("Navigation & header", nav.components, fonts, state, sidebarW));

  const main = figma.createFrame();
  main.name = "Dashboard / Main content";
  main.layoutMode = "VERTICAL";
  main.primaryAxisSizingMode = "AUTO";
  main.counterAxisSizingMode = "FIXED";
  main.itemSpacing = 16;
  main.resize(mainW, 10);
  main.fills = [];

  const kpi = getSection(templateSections, "KPI cards and charts");
  main.appendChild(await createPreviewSlot("KPI cards & charts", kpi.components, fonts, state, mainW));
  const table = getSection(templateSections, "Data table and activity");
  main.appendChild(await createPreviewSlot("Data table & activity", table.components, fonts, state, mainW));
  shell.appendChild(main);

  return shell;
}

async function createLandingLayout(
  templateSections: { title: string; components: DesignSystemComponentInfo[] }[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
  width: number,
): Promise<FrameNode> {
  const page = figma.createFrame();
  page.name = "Landing Page / Website layout";
  page.layoutMode = "VERTICAL";
  page.primaryAxisSizingMode = "AUTO";
  page.counterAxisSizingMode = "FIXED";
  page.itemSpacing = 16;
  page.paddingLeft = 16;
  page.paddingRight = 16;
  page.paddingTop = 16;
  page.paddingBottom = 16;
  page.resize(width, 10);
  page.cornerRadius = 12;
  page.fills = [{ type: "SOLID", color: COLORS.white }];
  page.strokes = [{ type: "SOLID", color: COLORS.border }];
  page.strokeWeight = 1;

  const innerW = width - 32;
  const hero = getSection(templateSections, "Hero and primary CTA");
  page.appendChild(await createPreviewSlot("Hero / navigation / primary CTA", hero.components, fonts, state, innerW));
  const features = getSection(templateSections, "Feature grid");
  page.appendChild(await createPreviewSlot("Feature grid", features.components, fonts, state, innerW));
  const proof = getSection(templateSections, "Pricing, proof, and footer");
  page.appendChild(await createPreviewSlot("Pricing / proof / footer", proof.components, fonts, state, innerW));

  return page;
}

async function createGenericLayout(
  templateSections: { title: string; components: DesignSystemComponentInfo[] }[],
  layoutName: string,
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
  width: number,
): Promise<FrameNode> {
  const page = figma.createFrame();
  page.name = `${layoutName} / App layout`;
  page.layoutMode = "VERTICAL";
  page.primaryAxisSizingMode = "AUTO";
  page.counterAxisSizingMode = "FIXED";
  page.itemSpacing = 16;
  page.paddingLeft = 16;
  page.paddingRight = 16;
  page.paddingTop = 16;
  page.paddingBottom = 16;
  page.resize(width, 10);
  page.cornerRadius = 12;
  page.fills = [{ type: "SOLID", color: COLORS.white }];
  page.strokes = [{ type: "SOLID", color: COLORS.border }];
  page.strokeWeight = 1;

  const innerW = width - 32;
  for (const section of templateSections) {
    page.appendChild(await createPreviewSlot(section.title, section.components, fonts, state, innerW));
  }

  return page;
}

async function createTemplatePreview(
  project: FigmaProjectFrameRequest,
  templateSections: { title: string; components: DesignSystemComponentInfo[] }[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
): Promise<FrameNode> {
  const width = CONTENT_WIDTH;
  const templateName = project.layoutTemplate || "Dashboard";

  const wrapper = createSection(`${templateName} — Component mapping`, fonts.regular, fonts.semiBold, width);
  wrapper.name = `Template Preview / ${templateName}`;

  const innerWidth = width - 48;

  let layout: FrameNode;
  switch (templateName) {
    case "Dashboard":
      layout = await createDashboardLayout(templateSections, fonts, state, innerWidth);
      break;
    case "Landing page":
      layout = await createLandingLayout(templateSections, fonts, state, innerWidth);
      break;
    default:
      layout = await createGenericLayout(templateSections, templateName, fonts, state, innerWidth);
      break;
  }

  wrapper.appendChild(layout);

  const summary = createLabel(
    `${state.instanceCount} live instances · ${state.placeholderCount} placeholders`,
    fonts.regular, 12, COLORS.meta, innerWidth,
  );
  wrapper.appendChild(summary);

  return wrapper;
}

// ── Main frame builder ──

async function createProjectFrame(project: FigmaProjectFrameRequest): Promise<void> {
  const regularFont = await loadPreferredFont("Regular");
  const semiBoldFont = await loadPreferredFont("Semi Bold");
  const fonts = { regular: regularFont, semiBold: semiBoldFont };

  const frame = figma.createFrame();
  frame.name = `${project.projectName || "Desygn AI"} / Project Layout`;
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.itemSpacing = 32;
  frame.paddingLeft = FRAME_PADDING;
  frame.paddingRight = FRAME_PADDING;
  frame.paddingTop = FRAME_PADDING;
  frame.paddingBottom = FRAME_PADDING;
  frame.resize(FRAME_WIDTH, 10);
  frame.fills = [{ type: "SOLID", color: COLORS.bg }];

  // ── Header ──
  const header = figma.createFrame();
  header.name = "Project Header";
  header.layoutMode = "VERTICAL";
  header.primaryAxisSizingMode = "AUTO";
  header.counterAxisSizingMode = "FIXED";
  header.itemSpacing = 12;
  header.resize(CONTENT_WIDTH, 10);
  header.fills = [];

  const title = createLabel(project.projectName || "Desygn AI Project", semiBoldFont, 36, COLORS.title, CONTENT_WIDTH);
  header.appendChild(title);

  const subtitle = createLabel(
    `${project.industry} · ${project.style} · ${project.presetName}`,
    regularFont, 16, COLORS.body, CONTENT_WIDTH,
  );
  header.appendChild(subtitle);

  const tagRow = figma.createFrame();
  tagRow.name = "Project Metadata";
  tagRow.layoutMode = "HORIZONTAL";
  tagRow.layoutWrap = "WRAP";
  tagRow.primaryAxisSizingMode = "FIXED";
  tagRow.counterAxisSizingMode = "AUTO";
  tagRow.itemSpacing = 8;
  tagRow.counterAxisSpacing = 8;
  tagRow.resize(CONTENT_WIDTH, 10);
  tagRow.fills = [];

  const totalCount = project.components.length;
  const realCount = project.components.filter(c => c.source !== "suggested").length;
  const suggestedCount = totalCount - realCount;

  tagRow.appendChild(createPill(`${totalCount} components`, regularFont));
  if (realCount > 0) tagRow.appendChild(createPill(`${realCount} real`, regularFont));
  if (suggestedCount > 0) tagRow.appendChild(createPill(`${suggestedCount} suggested`, regularFont));
  tagRow.appendChild(createPill(`${project.variables.length} variables`, regularFont));
  tagRow.appendChild(createPill(project.layoutTemplate || "Dashboard", regularFont));
  tagRow.appendChild(createPill("AI-ready layout", regularFont));
  header.appendChild(tagRow);

  frame.appendChild(header);

  // ── Template preview ──
  const state: FrameBuildState = { instanceCount: 0, placeholderCount: 0 };
  const templateSections = getTemplateSections(project);
  frame.appendChild(await createTemplatePreview(project, templateSections, fonts, state));

  // ── Component inventory ──
  if (project.components.length > 0) {
    const inventory = createSection("Component inventory", regularFont, semiBoldFont, CONTENT_WIDTH);
    inventory.name = "Component Inventory";

    const inventoryRow = createRow("All components", CONTENT_WIDTH - 48);
    const shown = new Set<string>();
    for (const comp of project.components) {
      const key = componentPickKey(comp);
      if (shown.has(key)) continue;
      shown.add(key);
      const preview = await createComponentPreview(comp);
      if (preview) {
        state.instanceCount++;
        inventoryRow.appendChild(createInstanceCard(preview, comp.name, semiBoldFont));
      } else {
        state.placeholderCount++;
        inventoryRow.appendChild(createPlaceholder(comp, regularFont, semiBoldFont));
      }
    }
    inventory.appendChild(inventoryRow);
    frame.appendChild(inventory);
  }

  // ── Finalize ──
  figma.currentPage.appendChild(frame);
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);

  const message = state.instanceCount > 0
    ? `Created ${project.layoutTemplate || "Dashboard"} layout with ${state.instanceCount} live instances and ${state.placeholderCount} placeholders.`
    : `Created ${project.layoutTemplate || "Dashboard"} layout with ${state.placeholderCount} component placeholders.`;
  figma.notify(message, { timeout: 5000 });
  figma.ui.postMessage({
    type: "figma-project-frame-result",
    nodeId: frame.id,
    created: true,
    instanceCount: state.instanceCount,
    placeholderCount: state.placeholderCount,
    message,
  } satisfies PluginMessage);
}

// ── Handler ──

export async function handleProjectFrameMessage(msg: PluginMessage): Promise<boolean> {
  if (msg.type !== "create-figma-project-frame") return false;

  try {
    await createProjectFrame(msg.project);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    figma.notify(`Could not create project frame: ${message}`, { error: true, timeout: 5000 });
    figma.ui.postMessage({
      type: "figma-project-frame-result",
      created: false,
      instanceCount: 0,
      placeholderCount: 0,
      message,
    } satisfies PluginMessage);
  }
  return true;
}
