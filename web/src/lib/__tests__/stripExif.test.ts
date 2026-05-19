import { describe, it, expect, vi, beforeEach } from "vitest";
import { stripExif } from "../stripExif";

// Stubs for browser APIs (no jsdom in test env)
const mockDrawImage = vi.fn();
const mockToDataURL = vi.fn(() => "data:image/png;base64,CLEAN");
const mockGetContext = vi.fn(() => ({ drawImage: mockDrawImage }));

beforeEach(() => {
  vi.restoreAllMocks();
  mockDrawImage.mockClear();
  mockToDataURL.mockClear();
  mockGetContext.mockClear();

  // Stub document.createElement
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: mockGetContext,
          toDataURL: mockToDataURL,
        };
      }
      return {};
    },
  });

  // Stub Image constructor
  vi.stubGlobal(
    "Image",
    class MockImage {
      naturalWidth = 100;
      naturalHeight = 100;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
  );
});

describe("stripExif", () => {
  it("re-encodes image/png via canvas", async () => {
    const result = await stripExif("data:image/png;base64,ORIGINAL", "image/png");
    expect(result).toBe("data:image/png;base64,CLEAN");
    expect(mockDrawImage).toHaveBeenCalledOnce();
    expect(mockToDataURL).toHaveBeenCalledWith("image/png", undefined);
  });

  it("re-encodes image/jpeg with quality 0.92", async () => {
    const result = await stripExif("data:image/jpeg;base64,ORIGINAL", "image/jpeg");
    expect(result).toBe("data:image/png;base64,CLEAN");
    expect(mockToDataURL).toHaveBeenCalledWith("image/jpeg", 0.92);
  });

  it("passes through non-image MIME types unchanged", async () => {
    const dataUrl = "data:video/mp4;base64,VIDEO";
    const result = await stripExif(dataUrl, "video/mp4");
    expect(result).toBe(dataUrl);
  });

  it("passes through SVG unchanged", async () => {
    const dataUrl = "data:image/svg+xml;base64,SVG";
    const result = await stripExif(dataUrl, "image/svg+xml");
    expect(result).toBe(dataUrl);
  });

  it("falls back to original on canvas context failure", async () => {
    mockGetContext.mockReturnValueOnce(null);
    const original = "data:image/png;base64,ORIGINAL";
    const result = await stripExif(original, "image/png");
    expect(result).toBe(original);
  });

  it("falls back to original on image decode error", async () => {
    vi.stubGlobal(
      "Image",
      class MockImageFail {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_: string) {
          setTimeout(() => this.onerror?.(), 0);
        }
      }
    );
    const original = "data:image/png;base64,BROKEN";
    const result = await stripExif(original, "image/png");
    expect(result).toBe(original);
  });
});
