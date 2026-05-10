import { describe, it, expect } from "vitest";
import { extractBaseName } from "../selection";

describe("extractBaseName — named breakpoint suffixes", () => {
  it("strips dash-separated breakpoint names", () => {
    expect(extractBaseName("Header-desktop")).toBe("Header");
    expect(extractBaseName("Hero-mobile")).toBe("Hero");
    expect(extractBaseName("Card-tablet")).toBe("Card");
  });

  it("strips Tailwind-style breakpoints (xs/sm/md/lg/xl/2xl/3xl)", () => {
    expect(extractBaseName("Panel-xs")).toBe("Panel");
    expect(extractBaseName("Panel-sm")).toBe("Panel");
    expect(extractBaseName("Panel-md")).toBe("Panel");
    expect(extractBaseName("Panel-lg")).toBe("Panel");
    expect(extractBaseName("Panel-xl")).toBe("Panel");
    expect(extractBaseName("Panel-2xl")).toBe("Panel");
    expect(extractBaseName("Panel-3xl")).toBe("Panel");
  });

  it("strips with underscore or slash separators", () => {
    expect(extractBaseName("Header_desktop")).toBe("Header");
    expect(extractBaseName("Header/mobile")).toBe("Header");
  });

  it("strips parenthesized breakpoint names", () => {
    expect(extractBaseName("Header (desktop)")).toBe("Header");
    expect(extractBaseName("Card(mobile)")).toBe("Card");
    expect(extractBaseName("Nav ( xs )")).toBe("Nav");
  });

  it("is case-insensitive", () => {
    expect(extractBaseName("Header-DESKTOP")).toBe("Header");
    expect(extractBaseName("Header-Mobile")).toBe("Header");
    expect(extractBaseName("Header (TABLET)")).toBe("Header");
  });
});

describe("extractBaseName — numeric width suffixes (allowlist only)", () => {
  it("strips common iOS/iPad widths", () => {
    expect(extractBaseName("Header-320")).toBe("Header");
    expect(extractBaseName("Header-375")).toBe("Header");
    expect(extractBaseName("Header-428")).toBe("Header");
    expect(extractBaseName("Header-768")).toBe("Header");
    expect(extractBaseName("Header-1024")).toBe("Header");
    expect(extractBaseName("Header-1194")).toBe("Header");
  });

  it("strips common desktop widths", () => {
    expect(extractBaseName("Hero-1280")).toBe("Hero");
    expect(extractBaseName("Hero-1440")).toBe("Hero");
    expect(extractBaseName("Hero-1920")).toBe("Hero");
    expect(extractBaseName("Hero-2560")).toBe("Hero");
  });

  it("does NOT strip arbitrary numbers not in the allowlist", () => {
    // 512 is not a typical viewport — avoids false positive on versioned names
    expect(extractBaseName("Icon-v2-512")).toBe("Icon-v2-512");
    expect(extractBaseName("Asset-42")).toBe("Asset-42");
    expect(extractBaseName("Button-999")).toBe("Button-999");
    expect(extractBaseName("Hero-1300")).toBe("Hero-1300");
  });
});

describe("extractBaseName — false-positive safeguards", () => {
  it("leaves names without viewport suffix untouched", () => {
    expect(extractBaseName("PrimaryButton")).toBe("PrimaryButton");
    expect(extractBaseName("hero-title")).toBe("hero-title");
    expect(extractBaseName("nav-link")).toBe("nav-link");
  });

  it("does not strip single-letter suffixes (s/m/l)", () => {
    // Deliberately excluded to avoid matching things like `Card-m`
    expect(extractBaseName("Card-m")).toBe("Card-m");
    expect(extractBaseName("Icon-s")).toBe("Icon-s");
    expect(extractBaseName("Badge-l")).toBe("Badge-l");
  });

  it("only strips suffix at end, not in the middle of the name", () => {
    expect(extractBaseName("desktop-hero")).toBe("desktop-hero");
    expect(extractBaseName("mobile-first-layout")).toBe("mobile-first-layout");
  });
});

describe("extractBaseName — whitespace handling", () => {
  it("trims result", () => {
    expect(extractBaseName("  Header-desktop  ")).toBe("Header");
  });

  it("handles extra whitespace around separators", () => {
    expect(extractBaseName("Header - desktop")).toBe("Header");
    expect(extractBaseName("Header ( desktop )")).toBe("Header");
  });

  it("does not treat space alone as a separator", () => {
    // Only /-_ or parens count — plain space should not trigger a strip
    expect(extractBaseName("Header desktop")).toBe("Header desktop");
  });
});
