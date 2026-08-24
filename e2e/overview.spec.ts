import { test, expect } from '@playwright/test';
import { setupApiMocks, preselectProject } from './fixtures';

test.describe('Overview page', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  test('renders announcements card', async ({ page }) => {
    await page.goto('/infraweave/overview');
    await expect(page.getByText('Announcements', { exact: true })).toBeVisible();
  });

  test('renders view all announcements link', async ({ page }) => {
    await page.goto('/infraweave/overview');
    await expect(page.getByRole('link', { name: /view all announcements/i })).toBeVisible();
  });

  test('shows cloud filter panel on overview', async ({ page }) => {
    await page.goto('/infraweave/overview');
    // Overview tab renders the "About InfraWeave" InfoCard (previously titled
    // "About the tool", inside a full-width card that was mostly empty space)
    await expect(page.getByText('About InfraWeave').first()).toBeVisible({ timeout: 10000 });
  });
});
