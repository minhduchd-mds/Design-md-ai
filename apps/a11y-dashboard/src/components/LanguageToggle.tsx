/**
 * LanguageToggle — vi/en switch backed by useTranslation().
 *
 * Extracted so the top bar and the settings page can share one control.
 * Renders a labelled radio-style group of ghost buttons reflecting the
 * active locale via aria-pressed.
 */

import { Button } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";
import type { Locale } from "../i18n/index.js";

const OPTIONS: Locale[] = ["vi", "en"];

export function LanguageToggle() {
  const { t, locale, setLocale } = useTranslation();

  return (
    <div role="group" aria-label={t("lang.toggleLabel")} style={{ display: "flex", gap: "var(--space-2)" }}>
      {OPTIONS.map((code) => (
        <Button
          key={code}
          variant="ghost"
          size="sm"
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
        >
          {t(code === "vi" ? "lang.vi" : "lang.en")}
        </Button>
      ))}
    </div>
  );
}
