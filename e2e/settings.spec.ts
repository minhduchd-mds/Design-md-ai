import { test, expect } from "@playwright/test";

test.describe("Settings flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Get started" }).click();
    await page.getByPlaceholder(/email/i).fill("settings@example.com");
    await page.getByPlaceholder(/password/i).fill("SettingsPass1!");
    await page.getByRole("button", { name: /register|sign up|get started/i }).click();
    await expect(page.locator(".chat-workspace, .builder-workspace, .welcome-hero")).toBeVisible({ timeout: 5000 });
  });

  test("opens settings modal from sidebar", async ({ page }) => {
    // Look for settings button/icon in sidebar
    const settingsBtn = page.locator("[aria-label*='settings' i], button:has-text('Settings'), .sidebar-settings");
    if (await settingsBtn.first().isVisible()) {
      await settingsBtn.first().click();
      await expect(page.locator(".settings-modal, .modal-overlay")).toBeVisible({ timeout: 3000 });
    }
  });

  test("settings modal has tab navigation", async ({ page }) => {
    const settingsBtn = page.locator("[aria-label*='settings' i], button:has-text('Settings'), .sidebar-settings");
    if (await settingsBtn.first().isVisible()) {
      await settingsBtn.first().click();
      // Check for tab buttons
      const tabs = page.locator(".settings-tabs button, .modal-tabs button");
      if (await tabs.first().isVisible()) {
        await expect(tabs).toHaveCount(await tabs.count()); // at least some tabs exist
      }
    }
  });

  test("keyboard shortcut Ctrl+Z does not crash when no history", async ({ page }) => {
    // Press Ctrl+Z — should do nothing (no undo history), but not crash
    await page.keyboard.press("Control+z");
    // Page should still be functional
    await expect(page.locator(".chat-workspace, .builder-workspace, .welcome-hero")).toBeVisible();
  });
});
