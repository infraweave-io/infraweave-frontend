import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { StackModuleUsage } from '../../../types/Deployment';
import { MemoryRouter } from 'react-router-dom';
import { ModuleStackUsageTableCard } from './ModuleStackUsageTableCard';

const dialogState = vi.hoisted(() => ({ props: undefined as any }));

vi.mock('../../modules/detail/ModuleVersions', () => ({
  DeploymentsDialog: (props: any) => {
    dialogState.props = props;
    return props.open ? <div role="dialog" aria-label="Deployment drilldown" /> : null;
  },
}));

const stackUse = (overrides: Partial<StackModuleUsage> = {}): StackModuleUsage => ({
  deployment_id: 'shared-deployment-id',
  status: 'succeeded',
  project_id: 'account-a',
  region: 'eu-west-1',
  environment: 'production',
  module: 'network-vpc',
  module_version: '1.0.0',
  module_type: 'module',
  module_track: 'stable',
  drift_detection: { enabled: false, interval: '', auto_remediate: false },
  next_drift_check_epoch: 0,
  initiated_by: 'test',
  epoch: 1,
  job_id: 'job',
  variables: {},
  dependencies: [],
  dependants: [],
  reference: '',
  error_text: '',
  output: {},
  has_drifted: false,
  policy_results: [],
  usageSource: 'stack',
  stackName: 'web-stack',
  stackTrack: 'stable',
  stackVersion: '1.0.0',
  componentIndex: 0,
  ...overrides,
});

const uses: StackModuleUsage[] = [
  stackUse({ componentIndex: 0 }),
  // A repeated component occurrence in one deployment is still one relationship use.
  stackUse({ componentIndex: 1 }),
  // The same deployment also appears under another stack version; group counts must union keys.
  stackUse({ stackVersion: '2.0.0' }),
  stackUse({
    project_id: 'account-b',
    region: 'us-east-1',
    stackName: 'api-stack',
    stackVersion: '3.0.0',
  }),
  stackUse({
    environment: 'staging',
    module_version: '2.0.0',
    region: 'eu-central-1',
  }),
  stackUse({
    module: 'message-queue',
    module_version: '4.0.0',
    project_id: 'account-c',
    region: 'ap-southeast-2',
    stackName: 'worker-stack',
  }),
];

const renderCard = (props: Partial<React.ComponentProps<typeof ModuleStackUsageTableCard>> = {}) =>
  render(
    <ModuleStackUsageTableCard
      selectedModuleName="network-vpc"
      uses={uses}
      filters={{}}
      loading={false}
      incomplete={false}
      {...props}
    />,
    { wrapper: MemoryRouter },
  );

const getTable = () => screen.getByRole('table');

const getGroupRow = (matches: (rowText: string) => boolean) => {
  const row = within(getTable())
    .getAllByRole('row')
    .find(
      (candidate) =>
        matches(candidate.textContent ?? '') &&
        within(candidate).queryByRole('button', { name: 'Expand' }) !== null,
    );
  if (!row) throw new Error('Could not find the collapsed relationship group');
  return row;
};

const expandGroup = async (
  user: ReturnType<typeof userEvent.setup>,
  matches: (rowText: string) => boolean,
) => {
  await user.click(within(getGroupRow(matches)).getByRole('button', { name: 'Expand' }));
};

const showColumns = async (user: ReturnType<typeof userEvent.setup>, columns: string[]) => {
  await user.click(screen.getByRole('button', { name: /show\/hide columns/i }));
  const menu = screen.getByRole('menu');
  for (const column of columns) {
    await user.click(within(menu).getByRole('switch', { name: `Toggle visibility ${column}` }));
  }
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
};

beforeEach(() => {
  dialogState.props = undefined;
});

describe('ModuleStackUsageTableCard', () => {
  it('shows only the selected module with collapsed compact version groups', () => {
    renderCard({ selectedModuleName: 'network-vpc' });

    const table = getTable();
    expect(within(table).queryByText('Module name', { exact: true })).not.toBeInTheDocument();
    expect(getGroupRow((text) => text.includes('1.0.0'))).toBeInTheDocument();
    expect(getGroupRow((text) => text.includes('2.0.0'))).toBeInTheDocument();
    expect(within(table).queryByText('4.0.0', { exact: true })).not.toBeInTheDocument();
    expect(within(table).queryByText('web-stack')).not.toBeInTheDocument();
    expect(within(table).queryByText('api-stack')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to next page' })).not.toBeInTheDocument();
  });
  it('shows the requested columns by default and can reveal deployment counts', async () => {
    const user = userEvent.setup();
    const { container } = renderCard({ selectedModuleName: 'network-vpc' });

    const table = getTable();
    expect(within(table).getByText('Module version', { exact: true })).toBeInTheDocument();
    expect(within(table).getByText('Stack', { exact: true })).toBeInTheDocument();
    expect(within(table).getByText('Stack version', { exact: true })).toBeInTheDocument();
    expect(within(table).queryByText('Deployments', { exact: true })).not.toBeInTheDocument();
    expect(within(table).queryByText('Accounts', { exact: true })).not.toBeInTheDocument();
    expect(within(table).queryByText('Regions', { exact: true })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /show\/hide columns/i }));
    const menu = screen.getByRole('menu');
    await user.click(within(menu).getByRole('switch', { name: /Toggle visibility Deployments/ }));
    expect(container.querySelector('thead')?.textContent).toContain('Deployments');
  });

  it('does not expose controls that can change the selected-module grouping', () => {
    renderCard({ selectedModuleName: 'network-vpc' });

    const table = getTable();
    expect(screen.queryByRole('button', { name: 'Grab' })).not.toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Column Actions' })).not.toBeInTheDocument();

    const moduleVersionChipText = screen
      .getAllByText('Module version')
      .find((element) => element.closest('.MuiChip-root'));
    const moduleVersionChip = moduleVersionChipText?.closest('.MuiChip-root');
    expect(moduleVersionChip).not.toBeNull();
    expect(moduleVersionChip?.querySelector('.MuiChip-deleteIcon')).toBeNull();
  });

  it('counts distinct deployment, account, and region keys across grouped relationships', async () => {
    const user = userEvent.setup();
    renderCard();
    await showColumns(user, ['Deployments', 'Accounts', 'Regions']);

    const versionGroup = getGroupRow((text) => text.includes('1.0.0'));
    expect(within(versionGroup).getByLabelText('Distinct deployments: 2')).toBeInTheDocument();
    expect(within(versionGroup).getByLabelText('Distinct accounts: 2')).toBeInTheDocument();
    expect(within(versionGroup).getByLabelText('Distinct regions: 2')).toBeInTheDocument();

    await expandGroup(user, (text) => text.includes('1.0.0'));
    const stackGroup = getGroupRow((text) => text.includes('web-stack'));
    expect(within(stackGroup).getByLabelText('Distinct deployments: 1')).toBeInTheDocument();
    expect(within(stackGroup).getByLabelText('Distinct accounts: 1')).toBeInTheDocument();
    expect(within(stackGroup).getByLabelText('Distinct regions: 1')).toBeInTheDocument();
  });

  it('applies page account and region filters to the visible relationships and counts', async () => {
    const user = userEvent.setup();
    const { rerender } = renderCard({ filters: { account: 'account-a' } });
    await showColumns(user, ['Deployments', 'Accounts', 'Regions']);

    const accountFilteredGroup = getGroupRow((text) => text.includes('1.0.0'));
    expect(
      within(accountFilteredGroup).getByLabelText('Distinct deployments: 1'),
    ).toBeInTheDocument();
    expect(within(accountFilteredGroup).getByLabelText('Distinct accounts: 1')).toBeInTheDocument();
    expect(within(accountFilteredGroup).getByLabelText('Distinct regions: 1')).toBeInTheDocument();

    rerender(
      <ModuleStackUsageTableCard
        selectedModuleName="network-vpc"
        uses={uses}
        filters={{ region: 'us-east-1' }}
        loading={false}
        incomplete={false}
      />,
    );
    const regionFilteredGroup = getGroupRow((text) => text.includes('1.0.0'));
    expect(
      within(regionFilteredGroup).getByLabelText('Distinct deployments: 1'),
    ).toBeInTheDocument();
    expect(within(regionFilteredGroup).getByLabelText('Distinct accounts: 1')).toBeInTheDocument();
    expect(within(regionFilteredGroup).getByLabelText('Distinct regions: 1')).toBeInTheDocument();

    rerender(
      <ModuleStackUsageTableCard
        selectedModuleName="network-vpc"
        uses={uses}
        filters={{ account: 'account-a', region: 'us-east-1' }}
        loading={false}
        incomplete={false}
      />,
    );
    expect(
      screen.getByText(
        'No deployed stack relationships for network-vpc match the current filters.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('links the module version to its module page, falling back to the stable track', () => {
    renderCard({
      uses: [
        stackUse({ module_version: '1.0.0+main.1', module_track: 'dev' }),
        stackUse({ module_version: '2.0.0', module_track: '' }),
      ],
    });

    expect(
      screen.getByRole('link', { name: 'View module network-vpc version 1.0.0+main.1' }),
    ).toHaveAttribute('href', '/infraweave/module/dev/network-vpc/1.0.0%2Bmain.1');
    expect(
      screen.getByRole('link', { name: 'View module network-vpc version 2.0.0' }),
    ).toHaveAttribute('href', '/infraweave/module/stable/network-vpc/2.0.0');
  });

  it('links the stack version to its stack page on the stack track', async () => {
    const user = userEvent.setup();
    renderCard({
      uses: [
        stackUse({ stackTrack: 'dev', stackVersion: '1.0.0+main.1' }),
        stackUse({ stackTrack: '', stackVersion: '2.0.0' }),
      ],
    });

    await expandGroup(user, (text) => text.includes('1.0.0'));
    await expandGroup(user, (text) => text.includes('web-stack'));

    expect(
      screen.getByRole('link', { name: 'View stack web-stack version 1.0.0+main.1' }),
    ).toHaveAttribute('href', '/infraweave/stack/dev/web-stack/1.0.0%2Bmain.1');
    expect(
      screen.getByRole('link', { name: 'View stack web-stack version 2.0.0' }),
    ).toHaveAttribute('href', '/infraweave/stack/stable/web-stack/2.0.0');
  });

  it('expands to a stack-version leaf and opens its exact filtered deployments', async () => {
    const user = userEvent.setup();
    renderCard({ filters: { account: 'account-a', region: 'eu-west-1' } });
    await showColumns(user, ['Deployments']);

    await expandGroup(user, (text) => text.includes('1.0.0'));
    await expandGroup(user, (text) => text.includes('web-stack'));

    expect(within(getTable()).getByText('2.0.0', { exact: true })).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: 'View deployments for module network-vpc version 1.0.0 in stack web-stack version 2.0.0',
      }),
    );

    expect(screen.getByRole('dialog', { name: 'Deployment drilldown' })).toBeInTheDocument();
    expect(dialogState.props).toMatchObject({
      moduleName: 'network-vpc',
      version: '1.0.0',
      includeDirectDeployments: false,
      initialProjectIds: ['account-a'],
      initialRegions: ['eu-west-1'],
      initialParentStack: { stackName: 'web-stack', stackVersion: '2.0.0' },
      rowLabel: 'Deployments',
    });
    expect(dialogState.props.stackModuleDeployments).toHaveLength(1);
    expect(
      dialogState.props.stackModuleDeployments.map((usage: StackModuleUsage) => [
        usage.module,
        usage.module_version,
        usage.stackName,
        usage.stackVersion,
        usage.project_id,
        usage.region,
      ]),
    ).toEqual([['network-vpc', '1.0.0', 'web-stack', '2.0.0', 'account-a', 'eu-west-1']]);
  });

  it('shows the incomplete-composition warning, loading progress, and empty state', () => {
    const { rerender } = renderCard({ uses: [], loading: true, incomplete: true });

    expect(screen.getByRole('status')).toHaveTextContent(/table may be incomplete/);
    expect(
      screen.getByRole('progressbar', { name: 'Loading deployed stack relationships' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    rerender(
      <ModuleStackUsageTableCard
        selectedModuleName="network-vpc"
        uses={[]}
        filters={{}}
        loading={false}
        incomplete
      />,
    );
    expect(
      screen.getByText(
        'No deployed stack relationships for network-vpc match the current filters.',
      ),
    ).toBeInTheDocument();
  });
});
