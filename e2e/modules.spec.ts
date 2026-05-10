import { test, expect } from '@playwright/test';
import { setupApiMocks, preselectProject } from './fixtures';

test.describe('Modules list', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  test('renders modules page', async ({ page }) => {
    await page.goto('/infraweave/modules');
    await expect(page.getByText(/modules/i).first()).toBeVisible();
  });

  test('shows S3Bucket module in list', async ({ page }) => {
    await page.goto('/infraweave/modules');
    await expect(page.getByText('s3bucket')).toBeVisible({ timeout: 10000 });
  });

  test('shows EC2 module in list', async ({ page }) => {
    await page.goto('/infraweave/modules');
    await expect(page.getByText('ec2')).toBeVisible({ timeout: 10000 });
  });

  test('shows version columns for tracks', async ({ page }) => {
    await page.goto('/infraweave/modules');
    await expect(page.getByText(/stable/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows module table headers', async ({ page }) => {
    await page.goto('/infraweave/modules');
    await expect(page.getByText(/module/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/latest.*version/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking module name opens detail dialog', async ({ page }) => {
    await page.goto('/infraweave/modules');
    await page.getByText('s3bucket').click({ timeout: 10000 });
    // A dialog or modal should appear
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  });

  test('module dialog shows version track selector', async ({ page }) => {
    await page.goto('/infraweave/modules');
    await page.getByText('s3bucket').click({ timeout: 10000 });
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ timeout: 5000 });
    // Track toggle buttons should be visible
    await expect(dialog.getByRole('group').first()).toBeVisible({ timeout: 5000 });
  });

  test('module dialog can be closed', async ({ page }) => {
    await page.goto('/infraweave/modules');
    await page.getByText('s3bucket').click({ timeout: 10000 });
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ timeout: 5000 });
    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});
