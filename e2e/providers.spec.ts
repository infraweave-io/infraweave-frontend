import { test, expect } from '@playwright/test';
import { setupApiMocks, preselectProject } from './fixtures';

test.describe('Providers list', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  test('renders providers page', async ({ page }) => {
    await page.goto('/infraweave/providers');
    await expect(page.getByText(/providers/i).first()).toBeVisible();
  });

  test('shows aws-5 provider', async ({ page }) => {
    await page.goto('/infraweave/providers');
    await expect(page.getByText('aws-5')).toBeVisible({ timeout: 10000 });
  });

  test('shows stable track version', async ({ page }) => {
    await page.goto('/infraweave/providers');
    await expect(page.getByText('0.0.2').first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking provider name navigates to detail page', async ({ page }) => {
    await page.goto('/infraweave/providers');
    await page.getByRole('link', { name: 'aws-5' }).click({ timeout: 10000 });
    await expect(page).toHaveURL(/\/infraweave\/provider\//);
  });
});

test.describe('Provider detail page', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  const providerUrl = '/infraweave/provider/stable/aws-5/0.0.2';

  test('renders provider detail page', async ({ page }) => {
    await page.goto(providerUrl);
    await expect(page.getByText(/aws-5/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows provider version', async ({ page }) => {
    await page.goto(providerUrl);
    await expect(page.getByRole('heading', { name: /Provider.*Version.*0\.0\.2/ })).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows provider description', async ({ page }) => {
    await page.goto(providerUrl);
    await expect(
      page.getByText('AWS Provider with default configuration.', { exact: false }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('shows back button', async ({ page }) => {
    await page.goto(providerUrl);
    await expect(page.getByRole('button', { name: 'back' })).toBeVisible({ timeout: 10000 });
  });

  test('back button navigates to providers list', async ({ page }) => {
    await page.goto('/infraweave/providers');
    await page.getByRole('link', { name: 'aws-5' }).click({ timeout: 10000 });
    await expect(page).toHaveURL(/\/infraweave\/provider\//);
    await page.getByRole('button', { name: 'back' }).click();
    await expect(page).toHaveURL(/\/infraweave\/providers/);
  });
});
