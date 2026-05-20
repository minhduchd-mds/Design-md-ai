/**
 * project-frame/fonts — Font resolution and loading.
 *
 * Discovers the document's preferred font family, resolves available styles,
 * loads fonts for component instances with mixed font usage.
 */

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
      if (node.fontName !== figma.mixed) return node.fontName;
    }
  } catch { /* ignore */ }
  return null;
}

async function findAvailableFamilyStyle(baseFont: FontName | null, requestedStyle: "Regular" | "Semi Bold"): Promise<FontName | null> {
  if (!baseFont || !figma.listAvailableFontsAsync) return null;
  try {
    const availableFonts = await figma.listAvailableFontsAsync();
    const familyFonts = availableFonts.map(f => f.fontName).filter(f => f.family === baseFont.family);
    if (familyFonts.length === 0) return null;
    const preferredStyles = requestedStyle === "Semi Bold"
      ? ["semibold", "demibold", "medium", "bold", normalizeFontStyle(baseFont.style)]
      : ["regular", "book", "normal", normalizeFontStyle(baseFont.style)];
    return (
      familyFonts.find(f => preferredStyles.includes(normalizeFontStyle(f.style))) ??
      familyFonts.find(f => normalizeFontStyle(f.style) === normalizeFontStyle(baseFont.style)) ??
      familyFonts[0]
    );
  } catch { return null; }
}

export async function loadPreferredFont(style: "Regular" | "Semi Bold" = "Regular"): Promise<FontName> {
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
    try { await figma.loadFontAsync(font); return font; } catch { /* next */ }
  }

  const fallback = { family: "Arial", style: style === "Semi Bold" ? "Bold" : "Regular" };
  await figma.loadFontAsync(fallback);
  return fallback;
}

// ── Node helpers ──

function isSceneNode(node: BaseNode | null): node is SceneNode {
  return !!node && "type" in node && node.type !== "DOCUMENT" && node.type !== "PAGE";
}

export async function loadInstanceFonts(node: SceneNode): Promise<void> {
  const loaded = new Set<string>();
  const textNodes: TextNode[] = [];

  function collect(n: SceneNode) {
    if (n.type === "TEXT") {
      textNodes.push(n);
    } else if ("children" in n) {
      for (const child of (n as ChildrenMixin).children) {
        if (isSceneNode(child)) collect(child);
      }
    }
  }
  collect(node);

  for (const tn of textNodes) {
    if (tn.fontName === figma.mixed) {
      const len = tn.characters.length;
      for (let i = 0; i < len; i++) {
        const font = tn.getRangeFontName(i, i + 1) as FontName;
        const key = fontKey(font);
        if (!loaded.has(key)) { loaded.add(key); try { await figma.loadFontAsync(font); } catch { /* skip */ } }
      }
    } else {
      const font = tn.fontName as FontName;
      const key = fontKey(font);
      if (!loaded.has(key)) { loaded.add(key); try { await figma.loadFontAsync(font); } catch { /* skip */ } }
    }
  }
}
