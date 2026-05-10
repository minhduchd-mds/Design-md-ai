import { describe, it, expect } from "vitest";
import { buildPath, colorToHex } from "../utils";

describe("buildPath", () => {
  it("joins ancestors and name with >", () => {
    expect(buildPath(["Root", "Child"], "Leaf")).toBe("Root > Child > Leaf");
  });

  it("returns just name when no ancestors", () => {
    expect(buildPath([], "Root")).toBe("Root");
  });

  it("handles single ancestor", () => {
    expect(buildPath(["Parent"], "Child")).toBe("Parent > Child");
  });
});

describe("colorToHex", () => {
  it("converts RGB to hex", () => {
    expect(colorToHex({ r: 255, g: 0, b: 128 })).toBe("#ff0080");
  });

  it("pads single-digit values", () => {
    expect(colorToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
  });

  it("converts white", () => {
    expect(colorToHex({ r: 255, g: 255, b: 255 })).toBe("#ffffff");
  });

  it("handles typical design token color", () => {
    expect(colorToHex({ r: 226, g: 0, b: 116 })).toBe("#e20074");
  });
});
