import { test, expect } from '@playwright/test';

test('login page renders and is accessible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('dashboard shows login prompt when unauthenticated', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/log in/i).first()).toBeVisible();
});

test('register page renders', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
});

test('no horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/login');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
