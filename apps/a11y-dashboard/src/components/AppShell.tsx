/**
 * AppShell — authenticated layout: sidebar + top bar + routed content.
 *
 * Owns the single <main> landmark for every page rendered inside it (the
 * routed pages must NOT render their own <main>). A skip link targets the
 * main region for keyboard users (WCAG 2.4.1).
 */

import { Outlet } from "@tanstack/react-router";
import { useTranslation } from "../i18n/index.js";
import { Sidebar } from "./Sidebar.js";
import { TopBar } from "./TopBar.js";
import styles from "./AppShell.module.css";

export function AppShell() {
  const { t } = useTranslation();

  return (
    <div className={styles.shell}>
      <a href="#main-content" className="skip-link">
        {t("nav.dashboard")}
      </a>
      <Sidebar />
      <div className={styles.body}>
        <TopBar />
        <main id="main-content" className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
