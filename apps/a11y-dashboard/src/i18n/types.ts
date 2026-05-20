/**
 * i18n types — locale union + the exhaustive translation-key union.
 *
 * Every user-facing string in the app has a stable key here. The `vi` and
 * `en` dictionaries are typed as `Record<TranslationKey, string>`, so adding
 * a key forces both locales to provide a value (compile-time completeness).
 */

export type Locale = "vi" | "en";

export const DEFAULT_LOCALE: Locale = "vi";
export const FALLBACK_LOCALE: Locale = "en";

/** localStorage key used to persist the active locale. */
export const LOCALE_STORAGE_KEY = "desygn-a11y.locale";

/** Union of every translatable string key rendered by the dashboard. */
export type TranslationKey =
  | "app.title"
  | "app.badge"
  | "app.tagline"
  | "card.title"
  | "card.body"
  | "button.startAudit"
  | "button.viewSample"
  | "status.line"
  | "lang.toggleLabel"
  | "lang.vi"
  | "lang.en";

/** A complete dictionary: one string per translation key. */
export type Dictionary = Record<TranslationKey, string>;
