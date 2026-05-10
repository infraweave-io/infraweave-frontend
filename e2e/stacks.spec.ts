import { test, expect } from '@playwright/test';
import { setupApiMocks, preselectProject } from './fixtures';

test.describe('Stacks list', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  test('renders stacks page', async ({ page }) => {
    await page.goto('/infraweave/stacks');
    await expect(page.getByText(/stacks/i).first()).toBeVisible();
  });

  test('shows BucketCollection stack', async ({ page }) => {
    await page.goto('/infraweave/stacks');
    await expect(page.getByText('bucketcollection')).toBeVisible({ timeout: 10000 });
  });

  test('shows version columns', async ({ page }) => {
    await page.goto('/infraweave/stacks');
    await expect(page.getByText(/latest.*version/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking stack name opens detail dialog', async ({ page }) => {
    await page.goto('/infraweave/stacks');
    await page.getByText('bucketcollection').click({ timeout: 10000 });
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });

  test('stack dialog can be closed', async ({ page }) => {
    await page.goto('/infraweave/stacks');
    await page.getByText('bucketcollection').click({ timeout: 10000 });
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ timeout: 5000 });
    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('Stack detail page', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  const stackUrl = '/infraweave/stack/dev/bucketcollection/0.0.15-dev%2Bmain.9';

  test('renders stack detail page', async ({ page }) => {
    await page.goto(stackUrl);
    await expect(page.getByText(/bucketcollection/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows stack name in header', async ({ page }) => {
    await page.goto(stackUrl);
    await expect(page.getByRole('heading', { name: 'BucketCollection', level: 1 })).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows stack version', async ({ page }) => {
    await page.goto(stackUrl);
    await expect(page.getByRole('heading', { name: /Stack.*Version.*0\.0\.15/ })).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows description', async ({ page }) => {
    await page.goto(stackUrl);
    await expect(page.getByText(/two S3-buckets/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows deploy button', async ({ page }) => {
    await page.goto(stackUrl);
    await expect(page.getByRole('button', { name: /deploy/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('back button navigates to stacks list', async ({ page }) => {
    await page.goto('/infraweave/stacks');
    await page.getByRole('link', { name: '0.0.15-dev+main.9' }).click();
    await expect(page).toHaveURL(/\/infraweave\/stack\//);
    await page.getByRole('button', { name: 'back' }).click();
    await expect(page).toHaveURL(/\/infraweave\/stacks/);
  });
});
