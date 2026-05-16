import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows landing page with login/register buttons", async ({ page }) => {
    await expect(page.locator(".landing-hero")).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
  });

  test("opens login modal on Login click", async ({ page }) => {
    await page.getByRole("button", { name: "Login" }).first().click();
    await expect(page.locator(".auth-modal")).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
  });

  test("registers a new account and enters workspace", async ({ page }) => {
    await page.getByRole("button", { name: "Get started" }).click();
    await page.getByPlaceholder(/email/i).fill("test@example.com");
    await page.getByPlaceholder(/password/i).fill("TestPass123!");

    // Click register/submit
    await page.getByRole("button", { name: /register|sign up|get started/i }).click();

    // Should enter the workspace view
    await expect(page.locator(".chat-workspace, .builder-workspace, .welcome-hero")).toBeVisible({ timeout: 5000 });
  });

  test("login with existing account shows workspace", async ({ page }) => {
    // First register
    await page.getByRole("button", { name: "Get started" }).click();
    await page.getByPlaceholder(/email/i).fill("user@test.com");
    await page.getByPlaceholder(/password/i).fill("SecurePass1!");
    await page.getByRole("button", { name: /register|sign up|get started/i }).click();
    await expect(page.locator(".chat-workspace, .builder-workspace, .welcome-hero")).toBeVisible({ timeout: 5000 });

    // Logout
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Login
    await page.getByRole("button", { name: "Login" }).first().click();
    await page.getByPlaceholder(/email/i).fill("user@test.com");
    await page.getByPlaceholder(/password/i).fill("SecurePass1!");
    await page.getByRole("button", { name: /login|sign in/i }).click();

    await expect(page.locator(".chat-workspace, .builder-workspace, .welcome-hero")).toBeVisible({ timeout: 5000 });
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.getByRole("button", { name: "Login" }).first().click();
    await page.getByPlaceholder(/email/i).fill("wrong@example.com");
    await page.getByPlaceholder(/password/i).fill("WrongPass!");
    await page.getByRole("button", { name: /login|sign in/i }).click();

    // Should show error toast or message
    await expect(page.locator(".toast-error, .auth-error, [role=alert]")).toBeVisible({ timeout: 3000 });
  });
});
