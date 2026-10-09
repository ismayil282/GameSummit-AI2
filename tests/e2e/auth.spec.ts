import { test, expect } from "@playwright/test";

test("authentication modes, callback recovery and mobile dark layout", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");
  await page.getByRole("button", { name: "Create Family Account", exact: true }).first().click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  await page.getByRole("button", { name: "Magic link", exact: true }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await page.goto("/auth/callback?error=access_denied");
  await expect(page).toHaveURL(/login\?auth_error=1/);
  await expect(page.getByRole("region", { name: "Welcome home." }).getByRole("alert")).toContainText("expired");
  await page.screenshot({ path: "test-results/login-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.getByRole("button", { name: "Log In", exact: true }).last()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/login-mobile-dark.png", fullPage: true });
  await page.goto("/pricing");
  await expect(page.getByRole("link", { name: "Pricing", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Pricing", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/pricing-mobile-dark.png", fullPage: true });
});

test("free family can download a standard digital album", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create a storybook", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export digital album", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.html$/);
});
