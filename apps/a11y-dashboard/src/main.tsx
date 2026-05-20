import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "./auth/AuthContext.js";
import { router } from "./router.js";
import "./styles/global.css";

/**
 * Bridges React auth state into the router: passes the live `auth` snapshot as
 * router context so route guards (beforeLoad) see the current session, and
 * invalidates the router whenever auth changes so guards re-run (e.g. after
 * sign-in/sign-out, or once the initial session check resolves).
 */
function RouterWithAuth() {
  const auth = useAuth();

  useEffect(() => {
    router.invalidate();
  }, [auth.session, auth.loading]);

  return <RouterProvider router={router} context={{ auth }} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterWithAuth />
    </AuthProvider>
  </React.StrictMode>,
);
