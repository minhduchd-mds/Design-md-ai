/**
 * useTranslation.ts — React hook for i18n
 *
 * Uses useSyncExternalStore so components re-render when the locale changes.
 *
 * @example
 * ```tsx
 * import { useTranslation } from "./i18n";
 *
 * function FilterTabs() {
 *   const { t, locale, setLocale } = useTranslation();
 *   return (
 *     <div>
 *       <button>{t("checklist.filter.all")}</button>
 *       <button>{t("checklist.filter.pass")}</button>
 *       <button onClick={() => setLocale("ja")}>JP</button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useSyncExternalStore, useCallback } from "react";
import { getLocale, setLocale, subscribeLocale, t as translate } from "./i18n";
import type { LocaleCode, TranslationValues } from "./types";

export interface UseTranslationResult {
  /** Translate a key. */
  t: (key: string, values?: TranslationValues) => string;
  /** Active locale code. */
  locale: LocaleCode;
  /** Change the active locale (persisted to localStorage). */
  setLocale: (locale: LocaleCode) => void;
}

export function useTranslation(): UseTranslationResult {
  const locale = useSyncExternalStore(
    subscribeLocale,
    getLocale,
    getLocale, // SSR snapshot
  );

  // Bind translate to the current locale to bust caching.
  // Each render reads the current value via the closure.
  const t = useCallback(
    (key: string, values?: TranslationValues) => {
      // locale is read above to ensure re-render on change
      void locale;
      return translate(key, values);
    },
    [locale],
  );

  return { t, locale, setLocale };
}
