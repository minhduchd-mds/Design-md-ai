/**
 * LocaleSelector.tsx — Dropdown to switch the active locale
 *
 * Drop this into Settings, sidebar, or any header. Persists to localStorage
 * automatically via the i18n core.
 */

import { useTranslation } from "./useTranslation";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "./types";
import type { LocaleCode } from "./types";

export interface LocaleSelectorProps {
  /** Optional class name applied to the <select> element */
  className?: string;
  /** Optional callback fired after the locale changes */
  onChange?: (locale: LocaleCode) => void;
}

export function LocaleSelector({ className, onChange }: LocaleSelectorProps) {
  const { locale, setLocale } = useTranslation();

  return (
    <select
      className={className}
      value={locale}
      onChange={(e) => {
        const next = e.target.value as LocaleCode;
        setLocale(next);
        onChange?.(next);
      }}
      aria-label="Select language"
    >
      {SUPPORTED_LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
