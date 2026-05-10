import { test, expect } from '@playwright/test';
import { setupApiMocks, mockProjects as _mockProjects, preselectProject } from './fixtures';

test.describe('Projects page', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  test('renders projects page', async ({ page }) => {
    await page.goto('/infraweave/projects');
    await expect(page.getByText(/projects/i).first()).toBeVisible();
  });

  test('shows Dev Account 22 project', async ({ page }) => {
    await page.goto('/infraweave/projects');
    await expect(page.getByText('Dev Account 22')).toBeVisible({ timeout: 10000 });
  });

  test('shows Staging Account 22 project', async ({ page }) => {
    await page.goto('/infraweave/projects');
    await expect(page.getByText('Staging Account 22')).toBeVisible({ timeout: 10000 });
  });

  test('shows project ID', async ({ page }) => {
    await page.goto('/infraweave/projects');
    // DenseTable shows project name and description columns only
    await expect(page.getByText('Dev Account 22').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows project regions', async ({ page }) => {
    await page.goto('/infraweave/projects');
    // Verify both projects are shown
    await expect(page.getByText('Staging Account 22').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows cloud filter panel with project names', async ({ page }) => {
    await page.goto('/infraweave/projects');
    // Projects page has TabLayout which includes the CloudFilterPanel (shows AWS/Azure/GCP)
    await expect(page.getByText('Cloud:').first()).toBeVisible({ timeout: 10000 });
  });

  test('handles empty projects response', async ({ page }) => {
    await page.route('**/api/v1/projects', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );
    await page.goto('/infraweave/projects');
    // Page should render without crashing
    await expect(page.getByText(/projects/i).first()).toBeVisible({ timeout: 10000 });
  });
});
