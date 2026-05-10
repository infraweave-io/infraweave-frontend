import { test, expect } from '@playwright/test';
import { setupApiMocks, preselectProject } from './fixtures';

test.describe('Deployment detail page', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  const project = '123808927999';
  const region = 'us-west-2';
  const env = 'dev';
  const deploymentId = 'bucket_collection_1';
  const detailUrl = `/infraweave/deployment/${project}/${region}/${env}/${deploymentId}/overview`;

  test('renders deployment detail page', async ({ page }) => {
    await page.goto(detailUrl);
    // In standalone mode, header shows "Deployment - bucket_collection_1"
    await expect(page.getByText('Deployment - bucket_collection_1')).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows module type in overview', async ({ page }) => {
    await page.goto(detailUrl);
    await expect(page.getByText('bucketcollection').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows status in overview', async ({ page }) => {
    await page.goto(detailUrl);
    await expect(page.getByText('successful').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows region in overview', async ({ page }) => {
    await page.goto(detailUrl);
    await expect(page.getByText('us-west-2').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows version in overview', async ({ page }) => {
    await page.goto(detailUrl);
    await expect(page.getByText('0.0.15-dev+main.9').first()).toBeVisible({ timeout: 10000 });
  });

  test('events tab URL navigates to events view', async ({ page }) => {
    const eventsUrl = `/infraweave/deployment/${project}/${region}/${env}/${deploymentId}/events`;
    await page.goto(eventsUrl);
    await expect(page).toHaveURL(/events/);
    await expect(page.getByText('Deployment - bucket_collection_1')).toBeVisible({
      timeout: 10000,
    });
  });

  test('back button in app bar navigates to deployments', async ({ page }) => {
    await page.goto('/infraweave/deployments');
    await expect(page.getByText('bucket_collection_1').first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('link', { name: 'bucket_collection_1' }).first().click();
    await expect(page).toHaveURL(/\/infraweave\/deployment\//);
    // Back button is an icon button with aria-label="back" in the standalone app bar
    await page.getByRole('button', { name: 'back' }).click();
    await expect(page).toHaveURL(/\/infraweave\/deployments/);
  });

  test('deleted deployment renders without crashing', async ({ page }) => {
    await page.route('**/api/v1/deployment/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          deleted: 1,
          status: 'deleted',
          deployment_id: 'bucket_collection_1',
          environment: 'dev',
          module: 'bucketcollection',
          module_version: '0.0.15-dev+main.9',
          region: 'us-west-2',
          project_id: '123808927999',
        }),
      }),
    );
    await page.goto(detailUrl);
    await expect(page.getByText('Deployment - bucket_collection_1')).toBeVisible({
      timeout: 10000,
    });
  });
});
