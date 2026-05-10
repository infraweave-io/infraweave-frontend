import { test, expect } from '@playwright/test';
import { setupApiMocks, preselectProject } from './fixtures';

test.describe('Policies list', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  test('renders policies page', async ({ page }) => {
    await page.goto('/infraweave/policies');
    await expect(page.getByText(/policies/i).first()).toBeVisible();
  });

  test('shows AllowedRegions policy', async ({ page }) => {
    await page.goto('/infraweave/policies');
    // The policies list renders policy.policy (lowercase slug), not policy_name
    await expect(page.getByText('allowed-regions').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows policy version', async ({ page }) => {
    await page.goto('/infraweave/policies');
    await expect(page.getByText('0.1.2').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows policy environment', async ({ page }) => {
    await page.goto('/infraweave/policies');
    await expect(page.getByText('aws').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Policy detail page', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  const policyUrl = '/infraweave/policy/aws/allowed-regions/0.1.2';

  test('renders policy detail page', async ({ page }) => {
    await page.goto(policyUrl);
    await expect(page.getByText(/allowed-regions/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows policy name in header', async ({ page }) => {
    await page.goto(policyUrl);
    // PolicyPage header shows value?.policy (lowercase slug)
    await expect(page.getByText('allowed-regions').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows policy version', async ({ page }) => {
    await page.goto(policyUrl);
    await expect(page.getByText('0.1.2')).toBeVisible({ timeout: 10000 });
  });

  test('shows policy description', async ({ page }) => {
    await page.goto(policyUrl);
    await expect(page.getByText(/Allowed Regions/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows back button', async ({ page }) => {
    await page.goto(policyUrl);
    await expect(page.getByRole('button', { name: 'back' })).toBeVisible({ timeout: 10000 });
  });

  test('back button navigates to policies list', async ({ page }) => {
    await page.goto('/infraweave/policies');
    await page.getByRole('link', { name: 'allowed-regions' }).click();
    await expect(page).toHaveURL(/\/infraweave\/policy\//);
    await page.getByRole('button', { name: 'back' }).click();
    await expect(page).toHaveURL(/\/infraweave\/policies/);
  });
});
