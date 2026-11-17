import { test, expect } from '@playwright/test';
import { setupApiMocks, preselectProject } from './fixtures';

test.describe('Overview page', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  test('renders the default widgets', async ({ page }) => {
    await page.goto('/infraweave/overview');
    await expect(page.getByRole('region', { name: 'Failed deployments' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Latest releases' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'About InfraWeave' })).toBeVisible();
  });

  test('removes and adds back a widget, keeping the layout on reload', async ({ page }) => {
    await page.goto('/infraweave/overview');
    await page.getByRole('button', { name: 'Customize' }).click();
    await page.getByRole('button', { name: 'Remove Recently visited' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('region', { name: 'Recently visited' })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('region', { name: 'Failed deployments' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Recently visited' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Customize' }).click();
    await page.getByRole('button', { name: 'Add widget' }).click();
    await page.getByRole('menuitem', { name: 'Recently visited' }).click();
    await expect(page.getByRole('region', { name: 'Recently visited' })).toBeVisible();
  });
});
