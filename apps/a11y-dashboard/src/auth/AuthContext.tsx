/**
 * AuthContext — app-wide authentication state for the A11y dashboard.
 *
 * `AuthProvider` resolves the current Supabase session on mount and subscribes
 * to auth state changes. When Supabase is not configured (no env vars) it
 * settles immediately into a signed-out, non-loading state so the app can run
 * in a degraded/dev mode without a backend.
 *
 * Consumers read `{ session, user, loading, signOut }` via `useAuth()`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase.js";

export interface AuthState {
  /** Current Supabase session, or `null` when signed out / no backend. */
  session: Session | null;
  /** Convenience accessor for `session.user`. */
  user: User | null;
  /** True until the initial session lookup resolves. */
  loading: boolean;
  /** Sign the current user out (no-op when no backend is configured). */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Only "loading" while a configured backend resolves the initial session.
  // With no backend we start already-settled, so the effect never has to
  // call setState synchronously (avoids cascading-render lint/perf issue).
  const [loading, setLoading] = useState(() => getSupabaseClient() !== null);

  useEffect(() => {
    const supabase = getSupabaseClient();

    // No backend: nothing to resolve — initial state is already settled.
    if (!supabase) return;

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, user: session?.user ?? null, loading, signOut }),
    [session, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the current auth state. Throws if used outside `<AuthProvider>`. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
