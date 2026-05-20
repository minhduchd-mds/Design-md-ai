/**
 * i18n unit tests — PURE functions only (node env, no React render, no jsdom).
 *
 * Covers:
 *   - default locale is "vi"
 *   - translate() returns the correct vi / en string
 *   - missing key falls back to en, then to the raw key
 *   - vi and en dictionaries have identical key sets
 */

import { describe, it, expect, afterEach } from "vitest";
import { getLocale, translate, isLocale } from "../index.js";
import { LOCALE_STORAGE_KEY, type TranslationKey } from "../types.js";
import { vi } from "../vi.js";
import { en } from "../en.js";

describe("getLocale", () => {
  const original = globalThis.localStorage;

  afterEach(() => {
    // Restore whatever was there (likely undefined in node) after each test.
    Object.defineProperty(globalThis, "localStorage", {
      value: original,
      configurable: true,
      writable: true,
    });
  });

  it("defaults to vi when nothing is persisted", () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(getLocale()).toBe("vi");
  });

  it("defaults to vi when an unsupported value is stored", () => {
    const store = new Map<string, string>([[LOCALE_STORAGE_KEY, "fr"]]);
    Object.defineProperty(globalThis, "localStorage", {
      value: { getItem: (k: string) => store.get(k) ?? null },
      configurable: true,
      writable: true,
    });
    expect(getLocale()).toBe("vi");
  });

  it("reads a persisted supported locale", () => {
    const store = new Map<string, string>([[LOCALE_STORAGE_KEY, "en"]]);
    Object.defineProperty(globalThis, "localStorage", {
      value: { getItem: (k: string) => store.get(k) ?? null },
      configurable: true,
      writable: true,
    });
    expect(getLocale()).toBe("en");
  });
});

describe("isLocale", () => {
  it("accepts supported locales and rejects everything else", () => {
    expect(isLocale("vi")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe("translate", () => {
  it("returns the Vietnamese string for the vi locale", () => {
    expect(translate("vi", "button.startAudit")).toBe("Bắt đầu kiểm tra");
    expect(translate("vi", "card.title")).toBe("Chạy lần kiểm tra đầu tiên");
  });

  it("returns the English string for the en locale", () => {
    expect(translate("en", "button.startAudit")).toBe("Start audit");
    expect(translate("en", "card.title")).toBe("Run your first audit");
  });

  it("falls back to en when the key is missing in the requested locale", () => {
    // Force a hole in the vi dictionary for an existing key.
    const key = "button.viewSample" as TranslationKey;
    const saved = vi[key];
    try {
      // Deliberately remove the key from vi to exercise the en fallback.
      delete vi[key];
      expect(translate("vi", key)).toBe(en[key]);
      expect(translate("vi", key)).toBe("View sample report");
    } finally {
      vi[key] = saved;
    }
  });

  it("falls back to the raw key when neither locale defines it", () => {
    const key = "status.line" as TranslationKey;
    const savedVi = vi[key];
    const savedEn = en[key];
    try {
      // Remove from both locales so even the fallback chain comes up empty.
      delete vi[key];
      delete en[key];
      expect(translate("vi", key)).toBe(key);
      expect(translate("en", key)).toBe(key);
    } finally {
      vi[key] = savedVi;
      en[key] = savedEn;
    }
  });
});

describe("dictionary parity", () => {
  it("vi and en cover exactly the same keys", () => {
    const viKeys = Object.keys(vi).sort();
    const enKeys = Object.keys(en).sort();
    expect(viKeys).toEqual(enKeys);
  });

  it("every key maps to a non-empty string in both locales", () => {
    for (const key of Object.keys(vi) as TranslationKey[]) {
      expect(typeof vi[key]).toBe("string");
      expect(vi[key].length).toBeGreaterThan(0);
      expect(typeof en[key]).toBe("string");
      expect(en[key].length).toBeGreaterThan(0);
    }
  });
});
