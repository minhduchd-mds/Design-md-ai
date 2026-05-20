/**
 * Audits — placeholder list page inside the app shell.
 *
 * Renders one <h1> + a primary CTA button (no <main>; the shell owns it).
 */

import { Button, Card } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";

export function Audits() {
  const { t } = useTranslation();

  return (
    <>
      <h1 style={{ marginTop: 0 }}>{t("audits.title")}</h1>
      <Card variant="elevated" style={{ marginTop: "var(--space-4)" }}>
        <p style={{ color: "var(--color-slate-600)", marginTop: 0 }}>{t("audits.body")}</p>
        <Button variant="primary">{t("audits.cta")}</Button>
      </Card>
    </>
  );
}
