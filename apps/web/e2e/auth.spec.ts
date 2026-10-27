import { test, expect } from '@playwright/test';

test('register page renders with exact-8 rule', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
  await expect(page.getByText('Password must be exactly 8 characters.')).toBeVisible();
  await expect(page.getByLabel(/confirm password/i)).toBeVisible();
});

test('login shows demo account, forgot link, and register link', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /use demo account/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
  await expect(page.getByText('user123@gmail.com')).toBeVisible();
});

test('forgot + reset pages render', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();
  await page.goto('/reset-password?token=0123456789abcdef');
  await expect(page.getByRole('heading', { name: /set a new password/i })).toBeVisible();
});

test('no horizontal overflow on register (mobile)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/register');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
