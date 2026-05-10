import { describe, it, expect } from "vitest";
import { detectAtomicLevel, analyzeAtomic, buildExportPlan } from "../atomic-detection";
import type { SerializedNode } from "../../../shared/types";

function makeNode(name: string, overrides?: Partial<SerializedNode>): SerializedNode {
  return { id: Math.random().toString(36), name, type: "FRAME", ...overrides };
}

function makeInstance(componentName: string, children?: SerializedNode[]): SerializedNode {
  return makeNode(componentName, { isInstance: true, componentName, children });
}

function makeComponent(name: string, children?: SerializedNode[]): SerializedNode {
  return makeNode(name, { isComponent: true, componentName: name, children });
}

describe("detectAtomicLevel", () => {
  it("classifies node with no components as unclassified", () => {
    const node = makeNode("icon", {
      children: [makeNode("path", { type: "VECTOR" })],
    });
    expect(detectAtomicLevel(node)).toBe("unclassified");
  });

  it("classifies node with 1-3 component children as molecule", () => {
    const node = makeNode("input-group", {
      children: [makeComponent("Input"), makeComponent("Label"), makeComponent("Icon")],
    });
    expect(detectAtomicLevel(node)).toBe("molecule");
  });

  it("classifies node with only atom children as molecule regardless of count", () => {
    const node = makeNode("toolbar", {
      children: [
        makeComponent("Logo"),
        makeComponent("NavItem"),
        makeComponent("Button"),
        makeComponent("SearchBar"),
        makeComponent("Avatar"),
      ],
    });
    // All children are atoms (no nested components) → molecule, not organism
    expect(detectAtomicLevel(node)).toBe("molecule");
  });

  it("classifies node as organism when children contain components (molecules inside)", () => {
    // SearchBar is a molecule (contains Input + Icon atoms)
    const searchBar = makeInstance("SearchBar", [makeInstance("Input"), makeInstance("Icon")]);
    const node = makeNode("header", {
      children: [
        makeComponent("Logo"),
        searchBar,
        makeComponent("Avatar"),
      ],
    });
    expect(detectAtomicLevel(node)).toBe("organism");
  });

  it("classifies organism by nesting depth", () => {
    // 3 instances but depth >=2 → organism
    const node = makeNode("Section/Hero/Default", {
      componentName: "Section/Hero/Default",
      children: [
        makeNode("wrapper", {
          children: [
            makeInstance("Button", [makeInstance("Icon")]),
            makeInstance("Heading"),
            makeInstance("Image"),
          ],
        }),
      ],
    });
    expect(detectAtomicLevel(node)).toBe("organism");
  });
});

describe("analyzeAtomic", () => {
  it("returns unclassified for nodes without components", () => {
    const node = makeNode("icon-star", { id: "n1" });
    const info = analyzeAtomic(node);
    expect(info.level).toBe("unclassified");
    expect(info.isComponentized).toBe(false);
  });

  it("returns molecule with sub-components for componentized node", () => {
    const node = makeNode("search-bar", {
      id: "n2",
      children: [makeComponent("Input"), makeComponent("Button"), makeComponent("Icon")],
    });
    const info = analyzeAtomic(node);
    expect(info.level).toBe("molecule");
    expect(info.isComponentized).toBe(true);
    expect(info.subComponents).toContain("Input");
    expect(info.subComponents).toContain("Button");
    expect(info.dependencyTree).not.toBeNull();
  });

  it("deduplicates sub-component names", () => {
    const node = makeNode("button-group", {
      id: "n3",
      children: [makeInstance("Button"), makeInstance("Button"), makeInstance("Button")],
    });
    const info = analyzeAtomic(node);
    expect(info.subComponents).toHaveLength(1);
  });

  it("lists significant frames when not componentized", () => {
    const node = makeNode("card", {
      id: "n4",
      children: [
        makeNode("header", { children: [makeNode("title", { type: "TEXT" })] }),
        makeNode("body", { children: [makeNode("text", { type: "TEXT" })] }),
      ],
    });
    const info = analyzeAtomic(node);
    expect(info.level).toBe("unclassified");
    expect(info.significantFrames).toContain("header");
    expect(info.significantFrames).toContain("body");
  });
});

describe("buildExportPlan", () => {
  it("sorts by level: atoms first, then molecules, then organisms (skips unclassified)", () => {
    const atom = analyzeAtomic(makeComponent("Button"));
    const molecule = analyzeAtomic(
      makeNode("input-group", { id: "m", children: [makeComponent("Input"), makeComponent("Label"), makeComponent("Icon")] }),
    );
    // Organism: contains a molecule (SearchBar has nested components)
    const organism = analyzeAtomic(
      makeNode("header", {
        id: "o",
        children: [
          makeComponent("Logo"),
          makeInstance("SearchBar", [makeInstance("Input"), makeInstance("Icon")]),
        ],
      }),
    );

    const plan = buildExportPlan([organism, molecule, atom]);
    // Plan should flatten the tree: atoms first, then molecules, then organisms
    const levels = plan.map((p) => p.level);
    const atomIdx = levels.indexOf("atom");
    const molIdx = levels.indexOf("molecule");
    const orgIdx = levels.indexOf("organism");
    expect(atomIdx).toBeLessThan(molIdx);
    expect(molIdx).toBeLessThan(orgIdx);
  });

  it("assigns sequential step numbers", () => {
    const atom = analyzeAtomic(makeComponent("Button"));
    const molecule = analyzeAtomic(
      makeNode("form", { id: "m", children: [makeInstance("Button"), makeInstance("Label")] }),
    );
    const plan = buildExportPlan([atom, molecule]);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].step).toBe(1);
    if (plan.length > 1) expect(plan[1].step).toBe(2);
  });

  it("includes context with dependency info from tree", () => {
    const molecule = analyzeAtomic(
      makeNode("form", { id: "m", children: [makeInstance("Button"), makeInstance("Input"), makeInstance("Label")] }),
    );

    const plan = buildExportPlan([molecule]);
    // The molecule should list its atom deps in context
    const molItem = plan.find((p) => p.name === "form");
    if (molItem) {
      expect(molItem.context).toContain("Button");
    }
  });
});
