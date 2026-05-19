/**
 * i18n.ts — Lightweight i18n core (zero dependencies)
 *
 * Features:
 *   - Dot-notation key resolution: t("checklist.filter.all")
 *   - Interpolation: t("greeting", { name: "Anna" }) where source is "Hi {{name}}!"
 *   - Locale fallback to English if a key is missing
 *   - LocalStorage persistence
 *   - Browser language auto-detection
 *
 * Design: no React dependency in this file — the hook lives in useTranslation.ts.
 */

import en from "./locales/en";
import vi from "./locales/vi";
import ja from "./locales/ja";
import { SUPPORTED_LOCALES } from "./types";
import type { LocaleCode, LocaleDictionary, TranslationValues } from "./types";

const STORAGE_KEY = "desygn-locale";

// ─────────────────────────────────────────────────────────────────────────────
// Locale registry
// ─────────────────────────────────────────────────────────────────────────────

const LOCALES: Record<LocaleCode, LocaleDictionary> = {
  en,
  vi,
  ja,
};

// ─────────────────────────────────────────────────────────────────────────────
// Current locale state (module-scoped)
// ─────────────────────────────────────────────────────────────────────────────

let currentLocale: LocaleCode = detectInitialLocale();
const subscribers = new Set<(locale: LocaleCode) => void>();

function detectInitialLocale(): LocaleCode {
  // 1. Stored preference
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isLocaleCode(stored)) return stored;
    } catch {
      // localStorage unavailable — fall through
    }

    // 2. Browser language
    const navLang = window.navigator?.language?.slice(0, 2).toLowerCase();
    if (navLang && isLocaleCode(navLang)) return navLang;
  }

  // 3. Default
  return "en";
}

function isLocaleCode(value: string): value is LocaleCode {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Key resolution
// ─────────────────────────────────────────────────────────────────────────────

function lookup(dict: LocaleDictionary, path: string[]): string | undefined {
  let node: unknown = dict;
  for (const segment of path) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const v = values[key];
    return v === undefined || v === null ? `{{${key}}}` : String(v);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translate a key for the active locale.
 * Falls back to English when the key is missing, then to the raw key.
 */
export function t(key: string, values?: TranslationValues): string {
  const path = key.split(".");
  const found =
    lookup(LOCALES[currentLocale], path) ?? lookup(LOCALES.en, path);
  return interpolate(found ?? key, values);
}

/** Get the active locale code. */
export function getLocale(): LocaleCode {
  return currentLocale;
}

/** Change the active locale and notify subscribers. */
export function setLocale(locale: LocaleCode): void {
  if (!isLocaleCode(locale)) return;
  if (locale === currentLocale) return;
  currentLocale = locale;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // localStorage unavailable
    }
  }
  for (const fn of subscribers) fn(locale);
}

/** Subscribe to locale changes. Returns an unsubscribe function. */
export function subscribeLocale(fn: (locale: LocaleCode) => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Reset to initial detection (test helper). */
export function resetLocaleForTests(): void {
  currentLocale = "en";
  subscribers.clear();
}
