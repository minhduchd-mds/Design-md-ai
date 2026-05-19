/**
 * i18n public API
 */

export { t, getLocale, setLocale, subscribeLocale } from "./i18n";
export { useTranslation } from "./useTranslation";
export { LocaleSelector } from "./LocaleSelector";
export type { LocaleSelectorProps } from "./LocaleSelector";
export type { UseTranslationResult } from "./useTranslation";
export {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
} from "./types";
export type { LocaleCode, LocaleDictionary, TranslationValues } from "./types";
