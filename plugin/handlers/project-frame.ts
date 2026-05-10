import type { DesignSystemComponentInfo, FigmaProjectFrameRequest, PluginMessage } from "../../shared/types";

const FRAME_WIDTH = 1440;
const FRAME_PADDING = 48;
const CARD_WIDTH = 260;
const CARD_HEIGHT = 140;

interface FrameBuildState {
  instanceCount: number;
  placeholderCount: number;
}

function normalizeFontStyle(style: string): string {
  return style.toLowerCase().replace(/\s+/g, "");
}

function fontKey(font: FontName): string {
  return `${font.family}/${font.style}`;
}

function getFontFromCurrentPage(): FontName | null {
  try {
    const textNodes = figma.currentPage.findAllWithCriteria({ types: ["TEXT"] });
    for (const node of textNodes) {
      if (node.fontName !== figma.mixed) {
        return node.fontName;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function findAvailableFamilyStyle(baseFont: FontName | null, requestedStyle: "Regular" | "Semi Bold"): Promise<FontName | null> {
  if (!baseFont || !figma.listAvailableFontsAsync) return null;

  try {
    const availableFonts = await figma.listAvailableFontsAsync();
    const familyFonts = availableFonts
      .map((font) => font.fontName)
      .filter((font) => font.family === baseFont.family);

    if (familyFonts.length === 0) return null;

    const preferredStyles =
      requestedStyle === "Semi Bold"
        ? ["semibold", "semibolditalic", "demibold", "medium", "bold", normalizeFontStyle(baseFont.style)]
        : ["regular", "book", "normal", "medium", normalizeFontStyle(baseFont.style)];

    return (
      familyFonts.find((font) => preferredStyles.includes(normalizeFontStyle(font.style))) ??
      familyFonts.find((font) => normalizeFontStyle(font.style) === normalizeFontStyle(baseFont.style)) ??
      familyFonts[0]
    );
  } catch {
    return null;
  }
}

async function loadPreferredFont(style: "Regular" | "Semi Bold" = "Regular"): Promise<FontName> {
  const documentFont = await findAvailableFamilyStyle(getFontFromCurrentPage(), style);
  const candidates: FontName[] = [
    ...(documentFont ? [documentFont] : []),
    { family: "Inter", style },
    { family: "Inter", style: style === "Semi Bold" ? "Medium" : "Regular" },
    { family: "Open Sauce Two", style: style === "Semi Bold" ? "SemiBold" : "Regular" },
    { family: "Open Sauce Two", style: style === "Semi Bold" ? "Medium" : "Regular" },
    { family: "Roboto", style: style === "Semi Bold" ? "Medium" : "Regular" },
  ];

  const seen = new Set<string>();
  for (const font of candidates) {
    const key = fontKey(font);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      await figma.loadFontAsync(font);
      return font;
    } catch {
      // Try the next available font.
    }
  }

  const fallback = { family: "Arial", style: style === "Semi Bold" ? "Bold" : "Regular" };
  await figma.loadFontAsync(fallback);
  return fallback;
}

function isSceneNode(node: BaseNode | null): node is SceneNode {
  return !!node && "type" in node && node.type !== "DOCUMENT" && node.type !== "PAGE";
}

function isComponentLike(node: SceneNode): node is ComponentNode | ComponentSetNode {
  return node.type === "COMPONENT" || node.type === "COMPONENT_SET";
}

function findDefaultVariant(componentSet: ComponentSetNode): ComponentNode | null {
  const components = componentSet.children.filter((child): child is ComponentNode => child.type === "COMPONENT");
  if (components.length === 0) return null;

  return (
    components.find((component) => {
      const values = Object.values(component.variantProperties ?? {}).map((value) => value.toLowerCase());
      return values.includes("default");
    }) ?? components[0]
  );
}

function applyText(node: TextNode, text: string, font: FontName, size: number, color = { r: 0.12, g: 0.14, b: 0.17 }) {
  node.fontName = font;
  node.fontSize = size;
  node.fills = [{ type: "SOLID", color }];
  node.characters = text;
}

function createLabel(text: string, font: FontName, size: number, color?: RGB): TextNode {
  const label = figma.createText();
  applyText(label, text, font, size, color);
  label.textAutoResize = "HEIGHT";
  label.resize(360, label.height);
  return label;
}

function createPill(text: string, font: FontName): FrameNode {
  const pill = figma.createFrame();
  pill.name = `Tag / ${text}`;
  pill.layoutMode = "HORIZONTAL";
  pill.primaryAxisSizingMode = "AUTO";
  pill.counterAxisSizingMode = "AUTO";
  pill.paddingLeft = 12;
  pill.paddingRight = 12;
  pill.paddingTop = 6;
  pill.paddingBottom = 6;
  pill.cornerRadius = 999;
  pill.fills = [{ type: "SOLID", color: { r: 0.94, g: 0.96, b: 0.98 } }];
  pill.strokes = [{ type: "SOLID", color: { r: 0.84, g: 0.87, b: 0.91 } }];

  const label = createLabel(text, font, 12, { r: 0.18, g: 0.22, b: 0.28 });
  label.resize(Math.max(60, text.length * 7), label.height);
  pill.appendChild(label);
  return pill;
}

function createPlaceholder(component: DesignSystemComponentInfo, regularFont: FontName, semiBoldFont: FontName): FrameNode {
  const card = figma.createFrame();
  card.name = `Component Placeholder / ${component.name}`;
  card.layoutMode = "VERTICAL";
  card.primaryAxisSizingMode = "FIXED";
  card.counterAxisSizingMode = "FIXED";
  card.itemSpacing = 10;
  card.paddingLeft = 16;
  card.paddingRight = 16;
  card.paddingTop = 16;
  card.paddingBottom = 16;
  card.resize(CARD_WIDTH, CARD_HEIGHT);
  card.cornerRadius = 8;
  card.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  card.strokes = [{ type: "SOLID", color: { r: 0.82, g: 0.85, b: 0.9 } }];

  const name = createLabel(component.name, semiBoldFont, 15, { r: 0.1, g: 0.12, b: 0.16 });
  const meta = createLabel(`${component.type} · ${component.pageName}`, regularFont, 12, { r: 0.36, g: 0.4, b: 0.47 });
  const id = createLabel(`Figma ID: ${component.id}`, regularFont, 10, { r: 0.5, g: 0.54, b: 0.6 });
  name.resize(CARD_WIDTH - 32, name.height);
  meta.resize(CARD_WIDTH - 32, meta.height);
  id.resize(CARD_WIDTH - 32, id.height);

  card.appendChild(name);
  card.appendChild(meta);
  card.appendChild(id);
  return card;
}

async function createComponentPreview(component: DesignSystemComponentInfo): Promise<SceneNode | null> {
  if (component.source === "suggested") return null;

  const nodeId = component.nodeId ?? (component.source === "library" ? undefined : component.id);
  const componentKey = component.componentKey ?? (component.source === "library" ? component.id : undefined);
  const node = nodeId ? await figma.getNodeByIdAsync(nodeId) : null;
  let sourceNode: ComponentNode | ComponentSetNode | null = null;

  if (isSceneNode(node) && isComponentLike(node)) {
    sourceNode = node;
  } else {
    try {
      if (!componentKey) return null;
      sourceNode =
        component.type === "COMPONENT_SET"
          ? await figma.importComponentSetByKeyAsync(componentKey)
          : await figma.importComponentByKeyAsync(componentKey);
    } catch {
      sourceNode = null;
    }
  }

  if (!sourceNode) return null;

  const source = sourceNode.type === "COMPONENT_SET" ? findDefaultVariant(sourceNode) : sourceNode;
  if (!source) return null;

  const instance = source.createInstance();
  instance.name = `Instance / ${component.name}`;
  const scale = Math.min(1, CARD_WIDTH / Math.max(1, instance.width), CARD_HEIGHT / Math.max(1, instance.height));
  if (scale < 1) instance.rescale(scale);
  return instance;
}

function componentPickKey(component: DesignSystemComponentInfo): string {
  return component.componentKey ?? component.nodeId ?? `${component.source ?? "unknown"}:${component.pageName}:${component.name}`;
}

function dedupeComponents(components: DesignSystemComponentInfo[]): DesignSystemComponentInfo[] {
  const seen = new Set<string>();
  return components.filter((component) => {
    const key = componentPickKey(component);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickComponents(
  components: DesignSystemComponentInfo[],
  pattern: RegExp,
  fallbackCount = 4,
  usedKeys = new Set<string>(),
): DesignSystemComponentInfo[] {
  const available = components.filter((component) => !usedKeys.has(componentPickKey(component)));
  const realComponents = available.filter((component) => component.source !== "suggested");
  const suggestedComponents = available.filter((component) => component.source === "suggested");
  const matches = dedupeComponents([
    ...realComponents.filter((component) => component.role ? pattern.test(component.role) : false),
    ...realComponents.filter((component) => pattern.test(component.name)),
    ...suggestedComponents.filter((component) => pattern.test(component.name) || (component.role ? pattern.test(component.role) : false)),
  ]);
  const selected = (matches.length > 0 ? matches : [...realComponents, ...suggestedComponents]).slice(0, fallbackCount);
  for (const component of selected) {
    usedKeys.add(componentPickKey(component));
  }
  return selected;
}

function findMappedComponents(project: FigmaProjectFrameRequest, sectionTitle: string): DesignSystemComponentInfo[] {
  const mappedKeys = project.templateComponentMappings?.[sectionTitle] ?? [];
  if (mappedKeys.length === 0) return [];
  const componentsByKey = new Map(project.components.map((component) => [componentPickKey(component), component]));
  return mappedKeys.map((key) => componentsByKey.get(key)).filter((component): component is DesignSystemComponentInfo => !!component);
}

function createSection(title: string, regularFont: FontName, semiBoldFont: FontName, width: number): FrameNode {
  const section = figma.createFrame();
  section.name = `Section / ${title}`;
  section.layoutMode = "VERTICAL";
  section.primaryAxisSizingMode = "AUTO";
  section.counterAxisSizingMode = "FIXED";
  section.itemSpacing = 16;
  section.paddingLeft = 24;
  section.paddingRight = 24;
  section.paddingTop = 24;
  section.paddingBottom = 24;
  section.resize(width, 180);
  section.cornerRadius = 12;
  section.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  section.strokes = [{ type: "SOLID", color: { r: 0.86, g: 0.88, b: 0.92 } }];

  const label = createLabel(title, semiBoldFont, 18, { r: 0.09, g: 0.11, b: 0.15 });
  label.resize(width - 48, label.height);
  section.appendChild(label);

  return section;
}

function createRow(name: string, width: number): FrameNode {
  const row = figma.createFrame();
  row.name = name;
  row.layoutMode = "HORIZONTAL";
  row.layoutWrap = "WRAP";
  row.primaryAxisSizingMode = "FIXED";
  row.counterAxisSizingMode = "AUTO";
  row.itemSpacing = 16;
  row.counterAxisSpacing = 16;
  row.resize(width, CARD_HEIGHT);
  row.fills = [];
  return row;
}

async function createPreviewSlot(
  title: string,
  components: DesignSystemComponentInfo[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
  width: number,
  minHeight: number,
): Promise<FrameNode> {
  const slot = figma.createFrame();
  slot.name = `Template Slot / ${title}`;
  slot.layoutMode = "VERTICAL";
  slot.primaryAxisSizingMode = "AUTO";
  slot.counterAxisSizingMode = "FIXED";
  slot.itemSpacing = 12;
  slot.paddingLeft = 14;
  slot.paddingRight = 14;
  slot.paddingTop = 14;
  slot.paddingBottom = 14;
  slot.resize(width, minHeight);
  slot.cornerRadius = 8;
  slot.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.99, b: 1 } }];
  slot.strokes = [{ type: "SOLID", color: { r: 0.82, g: 0.86, b: 0.92 } }];

  const label = createLabel(title, fonts.semiBold, 14, { r: 0.1, g: 0.12, b: 0.16 });
  label.resize(width - 28, label.height);
  slot.appendChild(label);

  const row = createRow(`${title} Components`, width - 28);
  await appendComponentCards(row, components, fonts, state);
  slot.appendChild(row);
  return slot;
}

function getSection(sections: { title: string; components: DesignSystemComponentInfo[] }[], title: string) {
  return sections.find((section) => section.title === title) ?? { title, components: [] };
}

async function createTemplatePreview(
  project: FigmaProjectFrameRequest,
  templateSections: { title: string; components: DesignSystemComponentInfo[] }[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
): Promise<FrameNode> {
  const width = FRAME_WIDTH - FRAME_PADDING * 2;
  const preview = createSection(`${project.layoutTemplate || "Dashboard"} preview`, fonts.regular, fonts.semiBold, width);
  preview.name = `Template Preview / ${project.layoutTemplate || "Dashboard"} / mapped components`;

  if (project.layoutTemplate === "Landing page") {
    const page = figma.createFrame();
    page.name = "Landing Page / Website layout";
    page.layoutMode = "VERTICAL";
    page.primaryAxisSizingMode = "AUTO";
    page.counterAxisSizingMode = "FIXED";
    page.itemSpacing = 20;
    page.paddingLeft = 20;
    page.paddingRight = 20;
    page.paddingTop = 20;
    page.paddingBottom = 20;
    page.resize(width - 48, 900);
    page.cornerRadius = 12;
    page.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    page.strokes = [{ type: "SOLID", color: { r: 0.86, g: 0.88, b: 0.92 } }];

    const hero = getSection(templateSections, "Hero and primary CTA");
    const features = getSection(templateSections, "Feature grid");
    const proof = getSection(templateSections, "Pricing, proof, and footer");
    page.appendChild(await createPreviewSlot("Hero / navigation / primary CTA", hero.components, fonts, state, width - 88, 300));
    page.appendChild(await createPreviewSlot("Feature grid", features.components, fonts, state, width - 88, 220));
    page.appendChild(await createPreviewSlot("Pricing / proof / footer", proof.components, fonts, state, width - 88, 220));
    preview.appendChild(page);
    return preview;
  }

  if (project.layoutTemplate === "Dashboard") {
    const shell = figma.createFrame();
    shell.name = "Dashboard / App layout";
    shell.layoutMode = "HORIZONTAL";
    shell.primaryAxisSizingMode = "FIXED";
    shell.counterAxisSizingMode = "AUTO";
    shell.itemSpacing = 18;
    shell.paddingLeft = 20;
    shell.paddingRight = 20;
    shell.paddingTop = 20;
    shell.paddingBottom = 20;
    shell.resize(width - 48, 720);
    shell.cornerRadius = 12;
    shell.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    shell.strokes = [{ type: "SOLID", color: { r: 0.86, g: 0.88, b: 0.92 } }];

    const nav = getSection(templateSections, "Navigation and header");
    const kpi = getSection(templateSections, "KPI cards and charts");
    const table = getSection(templateSections, "Data table and activity");
    shell.appendChild(await createPreviewSlot("Navigation and header", nav.components, fonts, state, 260, 620));
    const main = figma.createFrame();
    main.name = "Dashboard main content";
    main.layoutMode = "VERTICAL";
    main.primaryAxisSizingMode = "AUTO";
    main.counterAxisSizingMode = "FIXED";
    main.itemSpacing = 18;
    main.resize(width - 48 - 260 - 58, 620);
    main.fills = [];
    main.appendChild(await createPreviewSlot("KPI cards and charts", kpi.components, fonts, state, width - 48 - 260 - 58, 250));
    main.appendChild(await createPreviewSlot("Data table and activity", table.components, fonts, state, width - 48 - 260 - 58, 320));
    shell.appendChild(main);
    preview.appendChild(shell);
    return preview;
  }

  if (project.layoutTemplate === "Admin table") {
    const page = figma.createFrame();
    page.name = "Admin Table / App layout";
    page.layoutMode = "VERTICAL";
    page.primaryAxisSizingMode = "AUTO";
    page.counterAxisSizingMode = "FIXED";
    page.itemSpacing = 18;
    page.paddingLeft = 20;
    page.paddingRight = 20;
    page.paddingTop = 20;
    page.paddingBottom = 20;
    page.resize(width - 48, 760);
    page.cornerRadius = 12;
    page.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    page.strokes = [{ type: "SOLID", color: { r: 0.86, g: 0.88, b: 0.92 } }];
    for (const section of templateSections) {
      page.appendChild(await createPreviewSlot(section.title, section.components, fonts, state, width - 88, section.title.includes("Table") ? 320 : 170));
    }
    preview.appendChild(page);
    return preview;
  }

  for (const section of templateSections) {
    preview.appendChild(await createPreviewSlot(section.title, section.components, fonts, state, width - 48, CARD_HEIGHT + 56));
  }

  return preview;
}

async function appendComponentCards(
  container: FrameNode,
  components: DesignSystemComponentInfo[],
  fonts: { regular: FontName; semiBold: FontName },
  state: FrameBuildState,
) {
  for (const component of components) {
    const preview = await createComponentPreview(component);
    if (preview) {
      state.instanceCount++;
      container.appendChild(preview);
    } else {
      state.placeholderCount++;
      container.appendChild(createPlaceholder(component, fonts.regular, fonts.semiBold));
    }
  }
}

function getTemplateSections(project: FigmaProjectFrameRequest): { title: string; components: DesignSystemComponentInfo[] }[] {
  const components = project.components;
  const usedKeys = new Set<string>();
  const pick = (title: string, pattern: RegExp, fallbackCount: number) => {
    const mapped = findMappedComponents(project, title).filter((component) => !usedKeys.has(componentPickKey(component)));
    if (mapped.length > 0) {
      for (const component of mapped) {
        usedKeys.add(componentPickKey(component));
      }
      return mapped;
    }
    return pickComponents(components, pattern, fallbackCount, usedKeys);
  };
  switch (project.layoutTemplate) {
    case "Admin table":
      return [
        { title: "Header and filters", components: pick("Header and filters", /nav|header|filter|search|input|select|button/i, 6) },
        { title: "Table and pagination", components: pick("Table and pagination", /table|row|cell|pagination|checkbox|badge/i, 8) },
        { title: "Empty, loading, and error states", components: pick("Empty, loading, and error states", /empty|loading|skeleton|alert|toast|error/i, 4) },
      ];
    case "Settings":
      return [
        { title: "Settings navigation", components: pick("Settings navigation", /nav|tab|menu|sidebar/i, 4) },
        { title: "Form groups", components: pick("Form groups", /form|field|input|select|checkbox|radio|switch|button/i, 8) },
        { title: "Save and danger actions", components: pick("Save and danger actions", /button|alert|modal|dialog|toast/i, 5) },
      ];
    case "Landing page":
      return [
        { title: "Hero and primary CTA", components: pick("Hero and primary CTA", /hero|nav|button|badge|card/i, 6) },
        { title: "Feature grid", components: pick("Feature grid", /feature|card|tile|icon|badge/i, 8) },
        { title: "Pricing, proof, and footer", components: pick("Pricing, proof, and footer", /pricing|testimonial|logo|footer|card/i, 6) },
      ];
    case "Mobile app":
      return [
        { title: "Mobile shell", components: pick("Mobile shell", /mobile|nav|tab|bar|header/i, 4) },
        { title: "Content list", components: pick("Content list", /card|item|row|list|avatar|badge/i, 8) },
        { title: "Primary actions", components: pick("Primary actions", /button|input|modal|toast|empty/i, 6) },
      ];
    case "AI workspace":
      return [
        { title: "Conversation and sidebar", components: pick("Conversation and sidebar", /chat|conversation|message|sidebar|nav/i, 6) },
        { title: "Prompt composer", components: pick("Prompt composer", /prompt|input|textarea|button|select|model/i, 6) },
        { title: "Response, sources, and actions", components: pick("Response, sources, and actions", /response|source|citation|card|toolbar|button/i, 8) },
      ];
    case "Developer console":
      return [
        { title: "Console shell", components: pick("Console shell", /nav|sidebar|toolbar|command|menu/i, 6) },
        { title: "Resources and details", components: pick("Resources and details", /table|list|row|card|panel|detail/i, 8) },
        { title: "Logs and status", components: pick("Logs and status", /log|code|terminal|status|badge|alert/i, 6) },
      ];
    case "Dashboard":
    default:
      return [
        { title: "Navigation and header", components: pick("Navigation and header", /nav|header|menu|tab|button/i, 6) },
        { title: "KPI cards and charts", components: pick("KPI cards and charts", /metric|kpi|card|chart|graph|badge/i, 8) },
        { title: "Data table and activity", components: pick("Data table and activity", /table|row|list|activity|feed|avatar/i, 8) },
      ];
  }
}

async function createProjectFrame(project: FigmaProjectFrameRequest): Promise<void> {
  const regularFont = await loadPreferredFont("Regular");
  const semiBoldFont = await loadPreferredFont("Semi Bold");

  const frame = figma.createFrame();
  frame.name = `${project.projectName || "DesignReady"} / Project Layout`;
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.itemSpacing = 32;
  frame.paddingLeft = FRAME_PADDING;
  frame.paddingRight = FRAME_PADDING;
  frame.paddingTop = FRAME_PADDING;
  frame.paddingBottom = FRAME_PADDING;
  frame.resize(FRAME_WIDTH, 900);
  frame.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.98, b: 0.99 } }];

  const title = createLabel(project.projectName || "DesignReady Project", semiBoldFont, 36, { r: 0.07, g: 0.09, b: 0.13 });
  title.resize(FRAME_WIDTH - FRAME_PADDING * 2, title.height);
  const subtitle = createLabel(
    `${project.industry} · ${project.style} · ${project.presetName}`,
    regularFont,
    16,
    { r: 0.33, g: 0.37, b: 0.44 },
  );
  subtitle.resize(FRAME_WIDTH - FRAME_PADDING * 2, subtitle.height);

  const header = figma.createFrame();
  header.name = "Project Header";
  header.layoutMode = "VERTICAL";
  header.primaryAxisSizingMode = "AUTO";
  header.counterAxisSizingMode = "FIXED";
  header.itemSpacing = 12;
  header.resize(FRAME_WIDTH - FRAME_PADDING * 2, 120);
  header.fills = [];
  header.appendChild(title);
  header.appendChild(subtitle);

  const tagRow = figma.createFrame();
  tagRow.name = "Project Metadata";
  tagRow.layoutMode = "HORIZONTAL";
  tagRow.primaryAxisSizingMode = "AUTO";
  tagRow.counterAxisSizingMode = "AUTO";
  tagRow.itemSpacing = 8;
  tagRow.fills = [];
  tagRow.appendChild(createPill(`${project.components.length} components`, regularFont));
  tagRow.appendChild(createPill(`${project.components.filter((component) => component.source !== "suggested").length} real`, regularFont));
  tagRow.appendChild(createPill(`${project.components.filter((component) => component.source === "suggested").length} suggested`, regularFont));
  tagRow.appendChild(createPill(`${project.variables.length} variables`, regularFont));
  tagRow.appendChild(createPill(project.layoutTemplate || "Dashboard", regularFont));
  tagRow.appendChild(createPill("AI-ready layout", regularFont));
  header.appendChild(tagRow);

  const state: FrameBuildState = { instanceCount: 0, placeholderCount: 0 };
  const templateSections = getTemplateSections(project);

  frame.appendChild(header);
  frame.appendChild(await createTemplatePreview(project, templateSections, { regular: regularFont, semiBold: semiBoldFont }, state));
  figma.currentPage.appendChild(frame);
  figma.currentPage.selection = [frame];
  figma.viewport.scrollAndZoomIntoView([frame]);

  const message =
    state.instanceCount > 0
      ? `Created ${project.layoutTemplate} template with ${state.instanceCount} component instances and ${state.placeholderCount} placeholders.`
      : `Created ${project.layoutTemplate} template with ${state.placeholderCount} placeholders. Local component nodes were not available for instancing.`;
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
