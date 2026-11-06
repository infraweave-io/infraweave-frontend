import { test, expect } from '@playwright/test';
import { setupApiMocks, preselectProject } from './fixtures';

test.describe('Module detail page', () => {
  test.beforeEach(async ({ page }) => {
    await preselectProject(page);
    await setupApiMocks(page);
  });

  const moduleUrl = '/infraweave/module/dev/s3bucket/0.0.36-dev%2Btest.11';

  test('renders module detail page', async ({ page }) => {
    await page.goto(moduleUrl);
    await expect(page.getByText(/s3bucket/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows module name in header', async ({ page }) => {
    await page.goto(moduleUrl);
    await expect(page.getByRole('heading', { name: 'S3Bucket', level: 1 })).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows version in header', async ({ page }) => {
    await page.goto(moduleUrl);
    await expect(page.getByRole('heading', { name: /Module.*Version.*0\.0\.36/ })).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows module description', async ({ page }) => {
    await page.goto(moduleUrl);
    await expect(page.getByText('An S3 bucket is a storage service', { exact: false })).toBeVisible(
      { timeout: 10000 },
    );
  });

  test('shows deploy button', async ({ page }) => {
    await page.goto(moduleUrl);
    await expect(page.getByRole('button', { name: /deploy/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('header Create button opens paginated deploy dialog ending in editable manifest', async ({
    page,
  }) => {
    await page.goto(moduleUrl);

    // Green "Create" button lives in the page header on every tab.
    const createButton = page.getByRole('button', { name: 'Create' });
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // s3bucket mock has two examples, so a picker menu appears first.
    await page.getByRole('menuitem', { name: 'simple-bucket' }).click();

    // Step 1 (Destination): project/repo were preselected, so Next is enabled.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Please set a destination for this deployment')).toBeVisible({
      timeout: 10000,
    });
    await dialog.getByRole('button', { name: 'Next' }).click();

    // Step 2 (Deployment configuration + variables): pick a region, then advance.
    await expect(dialog.getByText('Please set a name for this deployment')).toBeVisible();
    await dialog.getByLabel('Regions').click();
    await page.getByRole('option').first().click();
    await dialog.getByRole('button', { name: 'Next' }).click();

    // Step 3 (Review & edit manifest): editor shows the generated claim, including the
    // namespace derived from the Environment field (defaults to "default").
    await expect(dialog.getByText('kind: S3Bucket', { exact: false })).toBeVisible();
    await expect(dialog.getByText('namespace: default', { exact: false })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /create merge request/i })).toBeVisible();
  });

  test('shows back button', async ({ page }) => {
    await page.goto(moduleUrl);
    await expect(page.getByRole('button', { name: 'back' })).toBeVisible({ timeout: 10000 });
  });

  test('back button navigates to modules list', async ({ page }) => {
    await page.goto('/infraweave/modules');
    await page
      .getByRole('link', { name: /0\.0\.36-dev\+test/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/infraweave\/module\//);
    await page.getByRole('button', { name: 'back' }).click();
    await expect(page).toHaveURL(/\/infraweave\/modules/);
  });
});
