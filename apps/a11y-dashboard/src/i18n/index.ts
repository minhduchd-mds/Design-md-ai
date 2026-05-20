/**
 * i18n — tiny, dependency-free internationalization for Desygn A11y.
 *
 * Design:
 *   - Two static dictionaries (`vi`, `en`), each a Record<TranslationKey, string>.
 *   - `translate()` is a PURE function: (locale, key) -> string, with fallback
 *     chain locale -> en -> the key itself. No I/O, safe to unit-test in node.
 *   - `getLocale` / `setLocale` own the side effects (localStorage + <html lang>).
 *   - `useTranslation()` is the React hook the UI consumes.
 *
 * Vietnamese is the default locale; English is the fallback.
 */

import { useCallback, useState } from "react";
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALE_STORAGE_KEY,
  type Dictionary,
  type Locale,
  type TranslationKey,
} from "./types.js";
import { vi } from "./vi.js";
import { en } from "./en.js";

const DICTIONARIES: Record<Locale, Dictionary> = { vi, en };

/** Type guard: is the given value one of our supported locales? */
export function isLocale(value: unknown): value is Locale {
  return value === "vi" || value === "en";
}

/**
 * Pure lookup. Returns the string for `key` in `locale`, falling back to the
 * English string, then to the raw key if neither locale defines it.
 */
export function translate(locale: Locale, key: TranslationKey): string {
  const primary = DICTIONARIES[locale]?.[key];
  if (primary != null) return primary;

  const fallback = DICTIONARIES[FALLBACK_LOCALE]?.[key];
  if (fallback != null) return fallback;

  return key;
}

/**
 * Read the active locale from localStorage. Defaults to "vi". Tolerates
 * environments without `localStorage` (e.g. SSR / tests) by returning the
 * default rather than throwing.
 */
export function getLocale(): Locale {
  try {
    const stored = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Access to localStorage can throw (privacy mode, etc.) — ignore.
  }
  return DEFAULT_LOCALE;
}

/**
 * Persist the active locale to localStorage and reflect it on
 * `document.documentElement.lang`. Both side effects are guarded so this is
 * safe to call in non-DOM environments.
 */
export function setLocale(locale: Locale): void {
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage write failures.
  }
  const doc = globalThis.document;
  if (doc?.documentElement) {
    doc.documentElement.lang = locale;
  }
}

export interface UseTranslation {
  /** Translate a key using the current locale. */
  t: (key: TranslationKey) => string;
  /** The currently active locale. */
  locale: Locale;
  /** Switch locale: updates state, localStorage, and <html lang>. */
  setLocale: (locale: Locale) => void;
}

/**
 * React hook exposing `{ t, locale, setLocale }`. Initializes from the
 * persisted locale and keeps the chosen locale in component state so a switch
 * re-renders consumers.
 */
export function useTranslation(): UseTranslation {
  const [locale, setLocaleState] = useState<Locale>(getLocale);

  const t = useCallback(
    (key: TranslationKey) => translate(locale, key),
    [locale],
  );

  const changeLocale = useCallback((next: Locale) => {
    setLocale(next);
    setLocaleState(next);
  }, []);

  return { t, locale, setLocale: changeLocale };
}

export type { Locale, TranslationKey } from "./types.js";
