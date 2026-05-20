import { test, expect } from "@playwright/test";

/**
 * Structural / role-based smoke tests for the Desygn A11y dashboard.
 *
 * IMPORTANT: These tests intentionally avoid ANY hardcoded text assertions.
 * The app is being localized and its default language may change (e.g. to
 * Vietnamese), so asserting English (or Vietnamese) copy would be brittle.
 * Only ARIA roles, landmarks, and structural attributes are checked.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders a single main landmark", async ({ page }) => {
  const main = page.getByRole("main");
  await expect(main).toBeVisible();
  await expect(main).toHaveCount(1);
});

test("has exactly one level-1 heading", async ({ page }) => {
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toBeVisible();
});

test("has at least one enabled, clickable button", async ({ page }) => {
  const buttons = page.getByRole("button");
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);

  // Find the first enabled button and confirm it is interactive.
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    if (await button.isEnabled()) {
      await expect(button).toBeVisible();
      await button.click();
      clicked = true;
      break;
    }
  }
  expect(clicked).toBe(true);
});

test("a11y smoke: html[lang] is set and every image has alt text", async ({
  page,
}) => {
  // The document must declare a language for assistive tech.
  const lang = await page.locator("html").getAttribute("lang");
  expect(lang, "html element must have a lang attribute").not.toBeNull();
  expect((lang ?? "").trim().length).toBeGreaterThan(0);

  // Every <img> (if any) must expose a non-null alt attribute. Defensive:
  // a page with zero images trivially passes.
  const images = page.locator("img");
  const imageCount = await images.count();
  for (let i = 0; i < imageCount; i++) {
    const alt = await images.nth(i).getAttribute("alt");
    expect(alt, `img[${i}] must have a non-null alt attribute`).not.toBeNull();
  }
});
