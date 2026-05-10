import { test, expect } from '@playwright/test';
import { setupApiMocks, preselectProject } from './fixtures';

test.describe('Module detail page', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  const moduleUrl = '/infraweave/module/dev/s3bucket/0.0.36-dev%2Btest.11';

  test('renders module detail page', async ({ page }) => {
    await page.goto(moduleUrl);
    await expect(page.getByText(/s3bucket/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows module name in header', async ({ page }) => {
    await page.goto(moduleUrl);
    await expect(page.getByRole('heading', { name: 'S3Bucket', level: 1 })).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows version in header', async ({ page }) => {
    await page.goto(moduleUrl);
    await expect(page.getByRole('heading', { name: /Module.*Version.*0\.0\.36/ })).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows module description', async ({ page }) => {
    await page.goto(moduleUrl);
    await expect(page.getByText('An S3 bucket is a storage service', { exact: false })).toBeVisible(
      { timeout: 10000 },
    );
  });

  test('shows deploy button', async ({ page }) => {
    await page.goto(moduleUrl);
    await expect(page.getByRole('button', { name: /deploy/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows back button', async ({ page }) => {
    await page.goto(moduleUrl);
    await expect(page.getByRole('button', { name: 'back' })).toBeVisible({ timeout: 10000 });
  });

  test('back button navigates to modules list', async ({ page }) => {
    await page.goto('/infraweave/modules');
    await page
      .getByRole('link', { name: /0\.0\.36-dev\+test/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/infraweave\/module\//);
    await page.getByRole('button', { name: 'back' }).click();
    await expect(page).toHaveURL(/\/infraweave\/modules/);
  });
});
