import { Page, Route } from '@playwright/test';
import { projects } from '../src/mocks/projects';
import { modules } from '../src/mocks/modules';
import { stacks } from '../src/mocks/stacks';
import { policies } from '../src/mocks/policies';
import { providers } from '../src/mocks/providers';
import {
  deployments_123808927999_us_west_2,
  deployments_123808927999_eu_central_1,
} from '../src/mocks/deployments';

// ─── Mock data aliases (re-exported for test use) ─────────────────────────────

export const mockProjects = projects;
export const mockModules = modules;
export const mockStacks = stacks;
export const mockPolicies = policies;
export const mockProviders = providers;
export const mockDeployments = [
  ...deployments_123808927999_us_west_2,
  ...deployments_123808927999_eu_central_1,
];

/**
 * Pre-select cloud providers, project and regions in localStorage so all list
 * components fetch data without requiring manual UI interaction.
 */
export async function preselectProject(page: Page) {
  await page.addInitScript((project) => {
    localStorage.setItem('selectedProviders', JSON.stringify(['aws']));
    localStorage.setItem('selectedProjectNames', JSON.stringify([project.name]));
    localStorage.setItem('selectedRegions', JSON.stringify(['us-west-2', 'eu-central-1']));
    localStorage.setItem('cachedProjects', JSON.stringify([project]));
    // Match the e2e bundle's mode (USE_MOCKS=false → 'real'), otherwise the
    // boot-time cleanup in src/standalone/index.tsx wipes these keys.
    localStorage.setItem('__app_mode__', 'real');
  }, projects[0]);
}

function json(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

/**
 * Set up all common API route mocks on the given page.
 * Call this in beforeEach or at the start of each test.
 */
export async function setupApiMocks(page: Page) {
  // Projects
  await page.route('**/api/v1/projects', (r) => json(r, mockProjects));

  // Deployments list
  await page.route('**/api/v1/deployments/**', (r) => json(r, mockDeployments));

  // Single deployment
  await page.route('**/api/v1/deployment/123808927999/us-west-2/dev/bucket_collection_1', (r) =>
    json(r, mockDeployments[0]),
  );
  await page.route('**/api/v1/deployment/123808927999/eu-central-1/dev/ec2_instance_1', (r) =>
    json(r, mockDeployments[1]),
  );
  // Fallback for any single deployment lookup
  await page.route('**/api/v1/deployment/**', (r) => json(r, mockDeployments[0]));

  // Events
  await page.route('**/api/v1/events/**', (r) =>
    json(r, [
      {
        PK: 'DEPLOYMENT#123808927999::us-west-2::dev::bucket_collection_1',
        SK: 'EVENT#2024-11-10T10:30:00.000Z',
        deployment_id: 'bucket_collection_1',
        environment: 'dev',
        epoch: Date.now() - 3600000,
        event_type: 'DEPLOYMENT',
        job_id: 'job-456',
        status: 'successful',
        change_type: 'APPLY',
        initiated_by: 'user@example.com',
      },
    ]),
  );

  // Logs
  await page.route('**/api/v1/logs/**', (r) =>
    json(r, {
      logs: 'Starting deployment...\nInitializing resources...\nApplying configuration...\n',
      nextBackwardToken: 'b/123/s',
      nextForwardToken: 'f/456/s',
    }),
  );

  // Modules list
  await page.route('**/api/v1/modules', (r) => json(r, mockModules));

  // Module versions
  await page.route('**/api/v1/modules/versions/**', (r) => json(r, [mockModules[0]]));

  // Single module
  await page.route('**/api/v1/module/**', (r) => json(r, mockModules[0]));

  // Stacks list
  await page.route('**/api/v1/stacks', (r) => json(r, mockStacks));

  // Stack versions
  await page.route('**/api/v1/stacks/versions/**', (r) => json(r, [mockStacks[0]]));

  // Single stack
  await page.route('**/api/v1/stack/**', (r) => json(r, mockStacks[0]));

  // Policies list
  await page.route('**/api/v1/policies/**', (r) => json(r, mockPolicies));

  // Single policy
  await page.route('**/api/v1/policy/**', (r) => json(r, mockPolicies[0]));

  // Providers list
  await page.route('**/api/v1/providers', (r) => json(r, mockProviders));

  // Provider versions
  await page.route('**/api/v1/providers/versions/**', (r) => json(r, [mockProviders[0]]));

  // Single provider
  await page.route('**/api/v1/provider/**', (r) => json(r, mockProviders[0]));

  // Observability / metrics endpoints — return empty to avoid errors
  await page.route('**/api/v1/metrics/**', (r) => json(r, []));
  await page.route('**/api/v1/stats/**', (r) => json(r, {}));
}
