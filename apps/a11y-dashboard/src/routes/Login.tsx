/**
 * Login — email/password sign-in form.
 *
 * Calls supabase.auth.signInWithPassword and redirects to /dashboard on
 * success. When Supabase is unconfigured (no backend) it still renders a
 * <main>, an <h1>, and a disabled button + explanatory notice so the e2e
 * structural contract holds in degraded mode. Errors surface via Input.error.
 */

import { useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, Card, Input } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase.js";
import { LanguageToggle } from "../components/LanguageToggle.js";
import styles from "./Auth.module.css";

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const emailId = useId();
  const passwordId = useId();

  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setError(undefined);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      await navigate({ to: "/dashboard" });
    } catch {
      setError(t("auth.genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.wrap}>
      <Card variant="elevated" className={styles.panel}>
        <div className={styles.header}>
          <h1 className={styles.heading}>{t("auth.login.title")}</h1>
          <LanguageToggle />
        </div>

        {!configured && (
          <>
            <p className={styles.notice}>{t("auth.backendUnconfiguredBody")}</p>
            <Button variant="primary" disabled>
              {t("auth.backendUnconfiguredCta")}
            </Button>
          </>
        )}

        {configured && (
          <>
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={emailId}>
                  {t("auth.emailLabel")}
                </label>
                <Input
                  id={emailId}
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  placeholder={t("auth.emailPlaceholder")}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor={passwordId}>
                  {t("auth.passwordLabel")}
                </label>
                <Input
                  id={passwordId}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  placeholder={t("auth.passwordPlaceholder")}
                  error={error}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" variant="primary" loading={loading}>
                {loading ? t("auth.login.submitting") : t("auth.login.submit")}
              </Button>
            </form>

            <p className={styles.footer}>
              {t("auth.login.toSignupPrompt")}{" "}
              <Link to="/signup">{t("auth.login.toSignupLink")}</Link>
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
