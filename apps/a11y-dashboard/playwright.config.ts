import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for the Desygn A11y dashboard.
 *
 * Tests use ONLY role/structural selectors (no text assertions) because the
 * app is being localized and its default language may change (e.g. to
 * Vietnamese). Asserting hardcoded copy would make these tests brittle.
 *
 * The dev server is started on-demand via `npm run dev` (vite --port 5180,
 * host 127.0.0.1) and an already-running instance is reused when present.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:5180",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5180",
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
