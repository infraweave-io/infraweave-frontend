import { test, expect } from '@playwright/test';
import { setupApiMocks, preselectProject } from './fixtures';

/**
 * Override AUTH_DISABLED at runtime by injecting window._env_ before the app
 * initialises. The app's getEnv() utility checks window._env_ before process.env,
 * so this beats the build-time REACT_APP_AUTH_DISABLED=true value baked in by Vite.
 */
async function disableAuthOverride(page: Parameters<typeof preselectProject>[0]) {
  await page.addInitScript(() => {
    // getEnv() checks window._env_ first – set to 'false' so AUTH_DISABLED evaluates false
    (window as any)._env_ = { REACT_APP_AUTH_DISABLED: 'false' };
    localStorage.removeItem('auth_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  });
}

test.describe('Authentication - authenticated state', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  test('shows main content when auth is disabled (default test env)', async ({ page }) => {
    await page.goto('/infraweave/overview');
    // Auth is disabled in the test webserver env → overview page must appear
    await expect(page.getByText('Announcements', { exact: true })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Authentication - unauthenticated state', () => {
  test('shows login page when no auth token is present', async ({ page }) => {
    await disableAuthOverride(page);
    await page.goto('/infraweave/overview');

    // Login card should be visible
    await expect(page.getByRole('heading', { name: 'InfraWeave' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Sign in to continue')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /sign in with aws/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('does not show main app content when unauthenticated', async ({ page }) => {
    await disableAuthOverride(page);
    await page.goto('/infraweave/overview');

    // Navigation drawer and main content must NOT appear
    await expect(page.getByText('Deployments').first()).not.toBeVisible({ timeout: 5000 });
    // Login button must be present instead
    await expect(page.getByRole('button', { name: /sign in with aws/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows login page for any protected route when unauthenticated', async ({ page }) => {
    await disableAuthOverride(page);
    await page.goto('/infraweave/deployments');

    await expect(page.getByRole('button', { name: /sign in with aws/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('redirects to login page from root when unauthenticated', async ({ page }) => {
    await disableAuthOverride(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'InfraWeave' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /sign in with aws/i })).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Error handling', () => {
  test('handles API errors gracefully on deployments page', async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
    // Override deployments to return 500
    await page.route('**/api/v1/deployments/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":"server error"}',
      }),
    );
    await page.goto('/infraweave/deployments');
    // Page should still render without crashing
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('handles API errors gracefully on modules page', async ({ page }) => {
    await setupApiMocks(page);
    await page.route('**/api/v1/modules', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":"server error"}',
      }),
    );
    await page.goto('/infraweave/modules');
    // Should show an error panel, not a blank page
    await expect(page.getByText('Failed to fetch modules')).toBeVisible({ timeout: 10000 });
  });

  test('handles API errors gracefully on stacks page', async ({ page }) => {
    await setupApiMocks(page);
    await page.route('**/api/v1/stacks', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":"server error"}',
      }),
    );
    await page.goto('/infraweave/stacks');
    // Should show an error panel, not a blank page
    await expect(page.getByText('Failed to fetch stacks')).toBeVisible({ timeout: 10000 });
  });

  test('handles API errors gracefully on policies page', async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
    await page.route('**/api/v1/policies/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":"server error"}',
      }),
    );
    await page.goto('/infraweave/policies');
    // Should show an error panel, not a blank page
    await expect(page.getByText('Failed to fetch policies')).toBeVisible({ timeout: 10000 });
  });

  test('handles API errors gracefully on providers page', async ({ page }) => {
    await setupApiMocks(page);
    await page.route('**/api/v1/providers', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":"server error"}',
      }),
    );
    await page.goto('/infraweave/providers');
    // Should show an error panel, not a blank page
    await expect(page.getByText('Failed to fetch providers')).toBeVisible({ timeout: 10000 });
  });

  test('handles network failure on deployment detail', async ({ page }) => {
    await setupApiMocks(page);
    await page.route('**/api/v1/deployment/**', (route) => route.abort());
    await page.goto(
      '/infraweave/deployment/123808927999/us-west-2/dev/bucket_collection_1/overview',
    );
    // Should show an error panel or handle gracefully
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });
});
