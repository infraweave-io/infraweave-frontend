import { test, expect } from '@playwright/test';
import { setupApiMocks, preselectProject } from './fixtures';

test.describe('Deployments list', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  test('renders deployments page heading', async ({ page }) => {
    await page.goto('/infraweave/deployments');
    await expect(page.getByText(/deployments/i).first()).toBeVisible();
  });

  test('shows deployments after project is loaded', async ({ page }) => {
    await page.goto('/infraweave/deployments');
    // Wait for projects to load and deployments to appear
    await expect(page.getByText('bucket_collection_1').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows ec2 deployment', async ({ page }) => {
    await page.goto('/infraweave/deployments');
    await expect(page.getByText('ec2_instance_1').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows deployment status badge', async ({ page }) => {
    await page.goto('/infraweave/deployments');
    await expect(page.getByText('bucket_collection_1').first()).toBeVisible({ timeout: 10000 });
    // Successful status appears in the table
    const statuses = page.getByText('successful');
    await expect(statuses.first()).toBeVisible({ timeout: 10000 });
  });

  test('shows module version in table', async ({ page }) => {
    await page.goto('/infraweave/deployments');
    await expect(page.getByText('0.0.15-dev+main.9').first()).toBeVisible({ timeout: 10000 });
  });

  test('deployment name links to detail page', async ({ page }) => {
    await page.goto('/infraweave/deployments');
    await expect(page.getByText('bucket_collection_1').first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: 'bucket_collection_1' }).first().click();
    await expect(page).toHaveURL(/\/infraweave\/deployment\//);
  });

  test('refresh button is visible', async ({ page }) => {
    await page.goto('/infraweave/deployments');
    // Refresh icon button
    await expect(
      page.locator('[data-testid="RefreshIcon"], button[aria-label*="efresh"]').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('shows table headers', async ({ page }) => {
    await page.goto('/infraweave/deployments');
    await expect(page.getByText('bucket_collection_1').first()).toBeVisible({ timeout: 10000 });
    // Deployments table should have column headers
    await expect(page.getByRole('columnheader').first()).toBeVisible({ timeout: 5000 });
  });

  test('shows region column', async ({ page }) => {
    await page.goto('/infraweave/deployments');
    await expect(page.getByText('bucket_collection_1').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('us-west-2').first()).toBeVisible({ timeout: 5000 });
  });
});
