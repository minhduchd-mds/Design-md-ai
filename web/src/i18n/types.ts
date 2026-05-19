/**
 * i18n/types.ts — Type definitions for the locale system
 */

export type LocaleCode = "en" | "vi" | "ja";

export const SUPPORTED_LOCALES: readonly LocaleCode[] = ["en", "vi", "ja"] as const;

export const LOCALE_LABELS: Record<LocaleCode, string> = {
  en: "English",
  vi: "Tiếng Việt",
  ja: "日本語",
};

/**
 * Translation interpolation values.
 * Use {{name}} placeholders in locale strings and pass them here.
 */
export type TranslationValues = Record<string, string | number>;

/**
 * Recursive locale dictionary. Allows nested keys like "checklist.filter.all".
 */
export interface LocaleDictionary {
  [key: string]: string | LocaleDictionary;
}
