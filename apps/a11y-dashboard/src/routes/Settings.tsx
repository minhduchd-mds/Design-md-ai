/**
 * Settings — placeholder settings page inside the app shell.
 *
 * Renders one <h1>, a language section (reusing LanguageToggle, which exposes
 * buttons), so the route satisfies the e2e structural checks. No <main>; the
 * shell owns it.
 */

import { Card } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";
import { LanguageToggle } from "../components/LanguageToggle.js";

export function Settings() {
  const { t } = useTranslation();

  return (
    <>
      <h1 style={{ marginTop: 0 }}>{t("settings.title")}</h1>
      <p style={{ color: "var(--color-slate-600)" }}>{t("settings.body")}</p>

      <Card variant="elevated" style={{ marginTop: "var(--space-4)" }}>
        <h2 style={{ marginTop: 0, fontSize: "var(--font-size-md, 1rem)" }}>
          {t("settings.languageHeading")}
        </h2>
        <LanguageToggle />
      </Card>
    </>
  );
}
