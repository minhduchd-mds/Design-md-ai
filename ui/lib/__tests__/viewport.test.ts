import { describe, it, expect } from "vitest";
import { detectViewport } from "../../../shared/viewport";

describe("detectViewport", () => {
  it("returns unknown for zero and negative widths", () => {
    expect(detectViewport(0)).toBe("unknown");
    expect(detectViewport(-100)).toBe("unknown");
  });

  it("classifies mobile up to 428px", () => {
    expect(detectViewport(1)).toBe("mobile");
    expect(detectViewport(320)).toBe("mobile");
    expect(detectViewport(375)).toBe("mobile");
    expect(detectViewport(428)).toBe("mobile");
  });

  it("classifies tablet from 429 to 1024px", () => {
    expect(detectViewport(429)).toBe("tablet");
    expect(detectViewport(768)).toBe("tablet");
    expect(detectViewport(1024)).toBe("tablet");
  });

  it("classifies desktop from 1025px upwards", () => {
    expect(detectViewport(1025)).toBe("desktop");
    expect(detectViewport(1100)).toBe("desktop");
    expect(detectViewport(1180)).toBe("desktop");
    expect(detectViewport(1194)).toBe("desktop");
    expect(detectViewport(1200)).toBe("desktop");
    expect(detectViewport(1280)).toBe("desktop");
    expect(detectViewport(1920)).toBe("desktop");
  });

  it("never returns unknown for any positive width (no gaps)", () => {
    const samples = [1, 100, 428, 429, 500, 1024, 1025, 1100, 1180, 1199, 1200, 1440, 2560];
    for (const w of samples) {
      expect(detectViewport(w)).not.toBe("unknown");
    }
  });
});
