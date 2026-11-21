import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { Deployment, StackModuleUsage } from '../../../types/Deployment';
import type { Module } from '../../../types/Module';
import type { FleetDeployments } from './useFleetDeployments';
import { ModuleStackUsageExplorerCard } from './ModuleStackUsageExplorerCard';

const hookState = vi.hoisted(() => ({
  fleet: undefined as any,
  usage: undefined as any,
  stackInputs: [] as Deployment[][],
}));

vi.mock('./useFleetDeployments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useFleetDeployments')>()),
  useFleetDeployments: () => hookState.fleet,
}));
vi.mock('./stackModuleUsage', () => ({
  useStackModuleUsage: (stackDeployments: Deployment[]) => {
    hookState.stackInputs.push(stackDeployments);
    return hookState.usage;
  },
}));
const stackDeployment = (
  deploymentId: string,
  module: string,
  projectId: string,
  region: string,
): Deployment => ({
  deployment_id: deploymentId,
  status: 'succeeded',
  project_id: projectId,
  region,
  environment: 'production',
  module,
  module_type: 'stack',
  module_version: '1.0.0',
  module_track: 'stable',
  drift_detection: { enabled: false, interval: '', auto_remediate: false },
  next_drift_check_epoch: 0,
  initiated_by: 'test-user',
  epoch: 1,
  job_id: `job-${deploymentId}`,
  variables: {},
  dependencies: [],
  dependants: [],
  reference: 'main',
  error_text: '',
  output: {},
  has_drifted: false,
  policy_results: [],
});

const stackUse = (
  module: string,
  deployment: Deployment,
  componentIndex: number,
): StackModuleUsage => ({
  ...deployment,
  module,
  module_type: 'module',
  module_version: '2.0.0',
  module_track: 'stable',
  usageSource: 'stack',
  stackName: deployment.module,
  stackVersion: deployment.module_version,
  componentIndex,
});

const deployments = [
  stackDeployment('web-deploy-1', 'web-stack', 'account-a', 'eu-west-1'),
  stackDeployment('api-deploy-1', 'api-stack', 'account-b', 'us-east-1'),
];
const uses = [stackUse('alpha', deployments[0], 0), stackUse('beta', deployments[1], 0)];

const standaloneDeployment: Deployment = {
  ...stackDeployment('queue-deploy-1', 'queue', 'account-a', 'eu-west-1'),
  module_type: 'module',
};

const fleet: FleetDeployments = {
  moduleCatalogue: [],
  stackCatalogue: [
    { module: 'web-stack', module_type: 'stack' },
    { module: 'api-stack', module_type: 'stack' },
  ] as unknown as Module[],
  projectNames: { 'account-a': 'Development', 'account-b': 'Production' },
  projectRegions: { 'account-a': ['eu-west-1'], 'account-b': ['us-east-1'] },
  regions: ['eu-west-1', 'us-east-1'],
  deployments: [...deployments, standaloneDeployment],
  fetchedAt: 1,
  loadingCatalog: false,
  catalogueIncomplete: false,
  accessKnown: true,
  nothingToLoad: false,
  loadingDeployments: false,
  loadFailed: false,
  error: null,
  refresh: () => {},
};

const renderCard = (entry = '/infraweave/adoption-health') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ModuleStackUsageExplorerCard />
    </MemoryRouter>,
  );

beforeEach(() => {
  hookState.fleet = fleet;
  hookState.usage = { uses, loading: false, incomplete: false };
  hookState.stackInputs = [];
});

describe('ModuleStackUsageExplorerCard', () => {
  it('shows the deployment explorer columns and deployment details', () => {
    renderCard();

    expect(screen.getByText('Deployment Explorer', { exact: true })).toBeVisible();
    const table = screen.getByRole('table');
    for (const column of ['Module', 'Module version', 'Stack', 'Stack version']) {
      expect(within(table).getByText(column, { exact: true })).toBeVisible();
    }

    const deploymentButton = within(table).getByRole('button', {
      name: 'View deployment web-deploy-1',
    });
    const deploymentRow = deploymentButton.closest('tr');
    expect(deploymentRow).not.toBeNull();
    expect(
      within(deploymentRow!).getByText('Development (account-a)', { exact: true }),
    ).toBeInTheDocument();
    expect(within(deploymentRow!).getByText('eu-west-1', { exact: true })).toBeInTheDocument();
    expect(within(deploymentRow!).getByText('production', { exact: true })).toBeInTheDocument();
    expect(within(deploymentRow!).getByText('succeeded', { exact: true })).toBeInTheDocument();
  });

  it('shows standalone deployments next to stack uses by default', () => {
    renderCard();

    const table = screen.getByRole('table');
    const standaloneRow = within(table)
      .getByRole('link', { name: 'View deployment queue-deploy-1' })
      .closest('tr');
    expect(standaloneRow).toHaveTextContent('queue');
    expect(standaloneRow).toHaveTextContent('—');
    expect(
      within(table).getByRole('button', { name: 'View deployment web-deploy-1' }),
    ).toBeInTheDocument();
  });

  it('shows only standalone deployments and skips composition expansion for the standalone source', () => {
    renderCard('/infraweave/adoption-health?moduleUsageMode=standalone');

    const table = screen.getByRole('table');
    expect(
      within(table).getByRole('link', { name: 'View deployment queue-deploy-1' }),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole('button', { name: 'View deployment web-deploy-1' }),
    ).not.toBeInTheDocument();
    expect(hookState.stackInputs.at(-1)).toEqual([]);
  });

  it('shows only stack uses for the within-stacks source', () => {
    renderCard('/infraweave/adoption-health?moduleUsageMode=in-stacks');

    const table = screen.getByRole('table');
    expect(
      within(table).getByRole('button', { name: 'View deployment web-deploy-1' }),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole('link', { name: 'View deployment queue-deploy-1' }),
    ).not.toBeInTheDocument();
  });

  it('shows the composition loading state', () => {
    hookState.usage = { uses: [], loading: true, incomplete: false };

    renderCard();

    expect(screen.getByText('Deployment Explorer', { exact: true })).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Loading deployments' })).toBeInTheDocument();
  });

  it('discloses incomplete relationship data', () => {
    hookState.fleet = { ...fleet, incomplete: 'request-failed' };
    hookState.usage = { uses, loading: false, incomplete: true };

    renderCard();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Some relationship data could not be fully loaded, so this table may be incomplete.',
    );
  });

  it('applies account and region URL context without selecting a module', () => {
    renderCard('/infraweave/adoption-health?account=account-a&region=eu-west-1');

    expect(
      within(screen.getByRole('table')).getAllByText('alpha', { exact: true }).length,
    ).toBeGreaterThan(0);
    expect(
      within(screen.getByRole('table')).queryByRole('row', { name: /beta/ }),
    ).not.toBeInTheDocument();
  });
  it.each([
    ['/infraweave/adoption-health?account=account-a', deployments[0]],
    ['/infraweave/adoption-health?region=us-east-1', deployments[1]],
  ])('limits composition expansion for context %s', (entry, expectedDeployment) => {
    renderCard(entry);

    expect(hookState.stackInputs.at(-1)).toEqual([expectedDeployment]);
  });

  it('shows only the stale-fleet warning when refresh failed but relationships are complete', () => {
    hookState.fleet = { ...fleet, loadFailed: true };

    renderCard();

    expect(
      screen.getByText(
        'The fleet could not be fully refreshed; this table may show only previously loaded deployments.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Some relationship data could not be fully loaded, so this table may be incomplete.',
      ),
    ).not.toBeInTheDocument();
  });
});
