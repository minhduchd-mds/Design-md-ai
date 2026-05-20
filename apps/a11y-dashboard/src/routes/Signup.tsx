/**
 * Signup — email/password account creation form.
 *
 * Calls supabase.auth.signUp. If the new session is returned immediately
 * (email confirmation disabled) it redirects to /dashboard; otherwise it shows
 * a "check your email" success notice. Degrades like Login when Supabase is
 * unconfigured: still renders <main>, <h1>, and a disabled button.
 */

import { useId, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button, Card, Input } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase.js";
import { LanguageToggle } from "../components/LanguageToggle.js";
import styles from "./Auth.module.css";

export function Signup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const emailId = useId();
  const passwordId = useId();

  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setError(undefined);
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      // If a session came back, confirmation is off — go straight in.
      if (data.session) {
        await navigate({ to: "/dashboard" });
        return;
      }
      setDone(true);
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
          <h1 className={styles.heading}>{t("auth.signup.title")}</h1>
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

        {configured && done && (
          <>
            <p className={styles.success}>{t("auth.signup.success")}</p>
            <Button variant="primary" onClick={() => navigate({ to: "/login" })}>
              {t("auth.signup.toLoginLink")}
            </Button>
          </>
        )}

        {configured && !done && (
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
                  autoComplete="new-password"
                  required
                  value={password}
                  placeholder={t("auth.passwordPlaceholder")}
                  error={error}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" variant="primary" loading={loading}>
                {loading ? t("auth.signup.submitting") : t("auth.signup.submit")}
              </Button>
            </form>

            <p className={styles.footer}>
              {t("auth.signup.toLoginPrompt")}{" "}
              <Link to="/login">{t("auth.signup.toLoginLink")}</Link>
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
