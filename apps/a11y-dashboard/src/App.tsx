/**
 * App — Root component for Desygn A11y dashboard.
 *
 * Week 0 scaffold, now dogfooding @desygn/ui primitives to validate
 * cross-package consumption. Week 3 adds TanStack Router, auth shell,
 * and protected routes per 04-frontend-architecture.md.
 *
 * All visible strings flow through useTranslation() (i18n/). Default
 * locale is Vietnamese; English is the fallback.
 */

import { Button, Card, Badge } from "@desygn/ui";
import { useTranslation } from "./i18n/index.js";
import type { Locale } from "./i18n/index.js";

function LanguageToggle() {
  const { t, locale, setLocale } = useTranslation();
  const options: Locale[] = ["vi", "en"];

  return (
    <div
      role="group"
      aria-label={t("lang.toggleLabel")}
      style={{ display: "flex", gap: "var(--space-2)", marginLeft: "auto" }}
    >
      {options.map((code) => (
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

export function App() {
  const { t } = useTranslation();

  return (
    <main style={{ padding: "var(--space-8)", maxWidth: 720, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <h1 style={{ margin: 0 }}>{t("app.title")}</h1>
        <Badge tone="info">{t("app.badge")}</Badge>
        <LanguageToggle />
      </header>

      <p style={{ color: "var(--color-slate-600)", marginTop: "var(--space-2)" }}>
        {t("app.tagline")}
      </p>

      <Card variant="elevated" style={{ marginTop: "var(--space-6)" }}>
        <h2 style={{ marginTop: 0 }}>{t("card.title")}</h2>
        <p style={{ color: "var(--color-slate-600)" }}>{t("card.body")}</p>
        <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
          <Button variant="primary">{t("button.startAudit")}</Button>
          <Button variant="ghost">{t("button.viewSample")}</Button>
        </div>
      </Card>

      <p style={{ marginTop: "var(--space-6)", color: "var(--color-slate-500)" }}>
        {t("status.line")}
      </p>
    </main>
  );
}
