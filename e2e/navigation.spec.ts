import { test, expect } from '@playwright/test';
import { setupApiMocks } from './fixtures';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('redirects root to /infraweave/overview', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/infraweave\/overview/);
  });

  test('renders sidebar with all navigation items', async ({ page }) => {
    await page.goto('/infraweave/overview');
    await expect(page.getByRole('button', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /deployments/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /stacks/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /modules/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /providers/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /policies/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /projects/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /observability/i })).toBeVisible();
  });

  test('navigates to Deployments via sidebar', async ({ page }) => {
    await page.goto('/infraweave/overview');
    await page.getByRole('button', { name: /^deployments$/i }).click();
    await expect(page).toHaveURL(/\/infraweave\/deployments/);
  });

  test('navigates to Modules via sidebar', async ({ page }) => {
    await page.goto('/infraweave/overview');
    await page.getByRole('button', { name: /^modules$/i }).click();
    await expect(page).toHaveURL(/\/infraweave\/modules/);
  });

  test('navigates to Stacks via sidebar', async ({ page }) => {
    await page.goto('/infraweave/overview');
    await page.getByRole('button', { name: /^stacks$/i }).click();
    await expect(page).toHaveURL(/\/infraweave\/stacks/);
  });

  test('navigates to Providers via sidebar', async ({ page }) => {
    await page.goto('/infraweave/overview');
    await page.getByRole('button', { name: /^providers$/i }).click();
    await expect(page).toHaveURL(/\/infraweave\/providers/);
  });

  test('navigates to Policies via sidebar', async ({ page }) => {
    await page.goto('/infraweave/overview');
    await page.getByRole('button', { name: /^policies$/i }).click();
    await expect(page).toHaveURL(/\/infraweave\/policies/);
  });

  test('navigates to Projects via sidebar', async ({ page }) => {
    await page.goto('/infraweave/overview');
    await page.getByRole('button', { name: /^projects$/i }).click();
    await expect(page).toHaveURL(/\/infraweave\/projects/);
  });

  test('navigates to Observability via sidebar', async ({ page }) => {
    await page.goto('/infraweave/overview');
    await page.getByRole('button', { name: /^observability$/i }).click();
    await expect(page).toHaveURL(/\/infraweave\/observability/);
  });

  test('completely unknown routes redirect to overview', async ({ page }) => {
    await page.goto('/completely/unknown/path');
    await expect(page).toHaveURL(/\/infraweave\/overview/);
  });
});
