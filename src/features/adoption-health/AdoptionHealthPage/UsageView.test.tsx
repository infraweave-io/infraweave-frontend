import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import type { Deployment, StackModuleUsage } from '../../../types/Deployment';
import { UsageView } from './UsageView';
import { BreakdownView } from './BreakdownView';

const usageMocks = vi.hoisted(() => ({
  fleet: undefined as any,
  stackUses: [] as any[],
  stackIncomplete: false,
  stackLoading: false,
  stackInputs: [] as any[][],
}));

vi.mock('./useFleetDeployments', () => ({
  useFleetDeployments: () => usageMocks.fleet,
  isStackDeployment: (deployment: Deployment, stackNames: Set<string>) =>
    deployment.module_type ? deployment.module_type === 'stack' : stackNames.has(deployment.module),
  moduleName: (module: { module?: string; module_name?: string }) =>
    module.module || module.module_name || '',
}));

vi.mock('./stackModuleUsage', () => ({
  useStackModuleUsage: (stackDeployments: Deployment[]) => {
    usageMocks.stackInputs.push(stackDeployments);
    return {
      uses: usageMocks.stackLoading ? [] : usageMocks.stackUses,
      loading: usageMocks.stackLoading,
      incomplete: usageMocks.stackIncomplete,
    };
  },
}));

vi.mock('./OverviewParts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./OverviewParts')>();
  return { ...actual, scrollToSection: vi.fn() };
});

vi.mock('../../modules/detail/ModuleVersions', () => ({
  DeploymentsDialog: ({
    open,
    moduleName,
    version,
    stackModuleDeployments,
  }: {
    open: boolean;
    moduleName: string;
    version: string;
    stackModuleDeployments: StackModuleUsage[];
  }) =>
    open ? (
      <div role="dialog" aria-label="Deployments">
        <span>
          {moduleName} {version}
        </span>
        {stackModuleDeployments
          .filter((deployment) => deployment.module_version === version)
          .map((deployment) => (
            <span key={`${deployment.deployment_id}-${deployment.componentIndex}`}>
              Parent stack: {deployment.stackName} {deployment.stackVersion}
            </span>
          ))}
      </div>
    ) : null,
}));

vi.mock('@mui/x-charts/BarChart', () => ({ BarChart: () => null }));

const deployment = (overrides: Partial<Deployment>): Deployment => ({
  deployment_id: 'deployment',
  status: 'succeeded',
  project_id: '111',
  region: 'eu-west-1',
  environment: 'production',
  module: 's3bucket',
  drift_detection: { enabled: false, interval: '', auto_remediate: false },
  next_drift_check_epoch: 0,
  initiated_by: 'test',
  epoch: 1,
  job_id: 'job',
  module_version: '1.0.0',
  module_type: 'module',
  module_track: 'stable',
  variables: {},
  dependencies: [],
  dependants: [],
  reference: '',
  error_text: '',
  output: {},
  has_drifted: false,
  policy_results: [],
  ...overrides,
});

const standalone = deployment({
  deployment_id: 'standalone-module',
  status: 'failed',
  module_version: '1.0.0',
});
const standaloneOnly = deployment({
  deployment_id: 'standalone-only-deployment',
  module: 'standalone-only',
  module_version: '9.0.0',
});
const firstStack = deployment({
  deployment_id: 'web-stack-deployment',
  module: 'web-stack',
  module_type: 'stack',
  module_version: '4.0.0',
  status: 'failed',
});
const secondStack = deployment({
  deployment_id: 'api-stack-deployment',
  module: 'api-stack',
  module_type: 'stack',
  module_version: '5.0.0',
  project_id: '222',
  region: 'us-east-1',
  status: 'succeeded',
});
const stackUses: StackModuleUsage[] = [
  {
    ...firstStack,
    module: 's3bucket',
    module_type: 'module',
    module_version: '2.0.0',
    usageSource: 'stack',
    stackName: 'web-stack',
    stackTrack: 'stable',
    stackVersion: '4.0.0',
    componentIndex: 0,
  },
  {
    ...firstStack,
    module: 's3bucket',
    module_type: 'module',
    module_version: '2.0.0',
    usageSource: 'stack',
    stackName: 'web-stack',
    stackTrack: 'stable',
    stackVersion: '4.0.0',
    componentIndex: 1,
  },
  {
    ...secondStack,
    module: 's3bucket',
    module_type: 'module',
    module_version: '3.0.0',
    usageSource: 'stack',
    stackName: 'api-stack',
    stackTrack: 'stable',
    stackVersion: '5.0.0',
    componentIndex: 0,
  },
];

const fleet = () => ({
  deployments: [standalone, standaloneOnly, firstStack, secondStack],
  moduleCatalogue: [
    { module: 's3bucket', module_name: 's3bucket' },
    { module: 'standalone-only', module_name: 'standalone-only' },
  ],
  stackCatalogue: [
    { module: 'web-stack', module_name: 'web-stack' },
    { module: 'api-stack', module_name: 'api-stack' },
  ],
  projectNames: { '111': 'Development', '222': 'Production' },
  projectRegions: { '111': ['eu-west-1'], '222': ['us-east-1'] },
  regions: ['eu-west-1', 'us-east-1'],
  fetchedAt: Date.now(),
  loadingCatalog: false,
  catalogueIncomplete: false,
  accessKnown: true,
  nothingToLoad: false,
  loadingDeployments: false,
  progress: { sources: [] },
  loadFailed: false,
  incomplete: undefined,
  error: null,
  refresh: vi.fn(),
});

const LocationProbe = () => <output data-testid="search">{useLocation().search}</output>;

const renderUsage = (search = '?module=s3bucket') =>
  render(
    <MemoryRouter initialEntries={[`/infraweave/adoption-health/module-usage${search}`]}>
      <UsageView kind="module" onBack={() => {}} />
      <LocationProbe />
    </MemoryRouter>,
  );
const renderBreakdown = (by: 'account' | 'region', search: string) =>
  render(
    <MemoryRouter initialEntries={[`/infraweave/adoption-health/${by}-usage${search}`]}>
      <BreakdownView by={by} onBack={() => {}} />
    </MemoryRouter>,
  );

const distributionTable = () => {
  const card = screen.getByText('Version Distribution by Region').closest('.MuiCard-root');
  if (!card) throw new Error('Version distribution card is missing');
  return within(card as HTMLElement).getByRole('table');
};

const versionRow = (version: string) =>
  within(distributionTable()).getByRole('row', {
    name: new RegExp(version.replaceAll('.', '\\.')),
  });
const rankingRow = (name: string) =>
  within(screen.getByRole('table', { name: /^modules by number of / })).getByRole('row', {
    name: new RegExp(name),
  });

const rankingCount = (name: string) => within(rankingRow(name)).getAllByRole('cell')[0];

describe('Module Usage source modes', () => {
  beforeEach(() => {
    usageMocks.fleet = fleet();
    usageMocks.stackUses = stackUses;
    usageMocks.stackInputs = [];
    usageMocks.stackIncomplete = false;
    usageMocks.stackLoading = false;
  });

  it('shows collapsed module-version groups in the selected module table', () => {
    renderUsage('?module=s3bucket&moduleUsageMode=both');

    const card = screen.getByText('Module versions in deployed stacks').closest('.MuiCard-root');
    if (!card) throw new Error('Module stack relationship table is missing');
    const table = within(card as HTMLElement).getByRole('table');

    expect(within(table).queryByText('Module name', { exact: true })).not.toBeInTheDocument();
    const collapsedVersionGroups = within(table)
      .getAllByRole('row')
      .filter((row) => within(row).queryByRole('button', { name: 'Expand' }) !== null);
    expect(collapsedVersionGroups).toHaveLength(2);
    expect(collapsedVersionGroups.some((row) => row.textContent?.includes('2.0.0'))).toBe(true);
    expect(collapsedVersionGroups.some((row) => row.textContent?.includes('3.0.0'))).toBe(true);
    expect(within(table).queryByText('web-stack')).not.toBeInTheDocument();
    expect(within(table).queryByText('api-stack')).not.toBeInTheDocument();
  });
  it.each(['in-stacks', 'both'] as const)(
    'uses the fleet-wide count while stack uses load in %s mode',
    (mode) => {
      usageMocks.stackLoading = true;
      renderUsage(`?module=s3bucket&moduleUsageMode=${mode}`);

      expect(
        screen.getByRole('progressbar', { name: 'Loading deployed stack compositions' }),
      ).toBeInTheDocument();
      expect(screen.getByText(/4 deployments across 2 accounts/)).toBeInTheDocument();
    },
  );

  it('hides breakdown results while stack uses load', () => {
    usageMocks.stackLoading = true;
    renderBreakdown(
      'account',
      '?module=s3bucket&kind=module&account=111&moduleUsageMode=in-stacks',
    );

    expect(
      screen.getByText('Loading deployed stack compositions for this module.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/4 deployments across 2 accounts/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'eu-west-1' })).not.toBeInTheDocument();
  });

  it('defaults to both and switches the ranking, versions, and account drilldown source', async () => {
    const user = userEvent.setup();
    renderUsage();
    expect(screen.getByText('Source: Both')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('search')).toHaveTextContent('?module=s3bucket');
    expect(screen.getByTestId('search')).not.toHaveTextContent('moduleUsageMode=');
    expect(versionRow('1.0.0')).toBeInTheDocument();
    expect(versionRow('2.0.0')).toBeInTheDocument();
    expect(versionRow('3.0.0')).toBeInTheDocument();
    expect(rankingCount('s3bucket')).toHaveTextContent('4');
    expect(
      screen.getByRole('table', { name: 'modules by number of deployments and uses' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^5 module deployments and uses across 2 accounts/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Within stacks' }));

    expect(screen.getByTestId('search')).toHaveTextContent('moduleUsageMode=in-stacks');
    expect(screen.getByText('Source: Within stacks')).toBeInTheDocument();
    expect(versionRow('2.0.0')).toBeInTheDocument();
    expect(versionRow('3.0.0')).toBeInTheDocument();
    expect(rankingCount('s3bucket')).toHaveTextContent('3');
    const inStackRanking = screen.getByRole('table', { name: 'modules by number of uses' });
    expect(
      within(inStackRanking).queryByRole('row', { name: /standalone-only/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/^3 module uses across 2 accounts/)).toBeInTheDocument();
    expect(screen.getByTitle('2 uses with status failed')).toBeInTheDocument();
    expect(screen.getByTitle('1 use with status succeeded')).toBeInTheDocument();
    expect(
      within(distributionTable()).queryByRole('row', { name: /1\.0\.0/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Select Module' }));
    expect(screen.queryByRole('option', { name: 'standalone-only' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(usageMocks.stackInputs.at(-1)?.map((item) => item.module)).toEqual([
      'web-stack',
      'api-stack',
    ]);
    expect(screen.getByRole('link', { name: 'Development' })).toHaveAttribute(
      'href',
      '/infraweave/adoption-health/account-usage?module=s3bucket&kind=module&account=111&moduleUsageMode=in-stacks',
    );

    await user.click(screen.getByRole('button', { name: 'Standalone' }));

    expect(screen.getByTestId('search')).toHaveTextContent('moduleUsageMode=standalone');
    expect(screen.getByText('Source: Standalone')).toBeInTheDocument();
    expect(screen.queryByText('Module versions in deployed stacks')).not.toBeInTheDocument();
    expect(versionRow('1.0.0')).toBeInTheDocument();
    expect(rankingCount('s3bucket')).toHaveTextContent('1');
    expect(rankingRow('standalone-only')).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Select Module' }));
    expect(await screen.findByRole('option', { name: 'standalone-only' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(
      within(distributionTable()).queryByRole('row', { name: /2\.0\.0|3\.0\.0/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Both' }));
    expect(screen.getByTestId('search')).not.toHaveTextContent('moduleUsageMode=');
    expect(screen.getByText('Source: Both')).toBeInTheDocument();
    expect(rankingCount('s3bucket')).toHaveTextContent('4');
    expect(screen.getByText('Module versions in deployed stacks')).toBeInTheDocument();
  }, 10_000);

  it('reveals parent-stack semantics on source help without changing the selected mode', async () => {
    const user = userEvent.setup();
    renderUsage();
    const help = screen.getByRole('button', { name: 'About stack metrics' });
    expect(help).toHaveAccessibleDescription(/parent stack deployment/i);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.hover(help);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/parent stack deployment/i);
    expect(screen.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps partial-results warnings attached to stack-containing modes', async () => {
    const user = userEvent.setup();
    usageMocks.stackIncomplete = true;
    renderUsage('?module=s3bucket&moduleUsageMode=standalone');

    expect(screen.queryByText(/usage may be incomplete/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Within stacks' }));
    expect(
      screen.getByText(/usage may be incomplete/i).closest('[role="status"]'),
    ).toBeInTheDocument();
    expect(screen.getByText('Counts may be incomplete')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Both' }));
    expect(
      screen.getByText(/usage may be incomplete/i).closest('[role="status"]'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Standalone' }));
    expect(screen.queryByText(/usage may be incomplete/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Counts may be incomplete')).not.toBeInTheDocument();
  });

  it('resets source-specific status filters and lists the parent stack for a selected component version', async () => {
    const user = userEvent.setup();
    renderUsage('?module=s3bucket&moduleUsageMode=both');

    await user.click(screen.getByRole('combobox', { name: 'Filter Status' }));
    await user.click(await screen.findByRole('option', { name: 'failed' }));
    expect(
      within(distributionTable()).queryByRole('row', { name: /3\.0\.0/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Within stacks' }));
    expect(versionRow('3.0.0')).toBeInTheDocument();

    await user.click(within(distributionTable()).getByRole('button', { name: '2.0.0' }));
    const dialog = await screen.findByRole('dialog', { name: 'Deployments' });
    expect(within(dialog).getAllByText('Parent stack: web-stack 4.0.0')).toHaveLength(2);
    expect(within(dialog).queryByText('Parent stack: api-stack 5.0.0')).not.toBeInTheDocument();
  });

  it('passes stack uses outside the page account filter to the dialog', async () => {
    const user = userEvent.setup();
    usageMocks.stackUses = [...stackUses, { ...stackUses[2], module_version: '2.0.0' }];
    renderUsage('?module=s3bucket&moduleUsageMode=in-stacks&account=111');

    await user.click(within(distributionTable()).getByRole('button', { name: '2.0.0' }));
    const dialog = await screen.findByRole('dialog', { name: 'Deployments' });
    expect(within(dialog).getByText('Parent stack: api-stack 5.0.0')).toBeInTheDocument();
  });
  it('expands stack-contained modules in account and region drilldowns', () => {
    const accountPage = renderBreakdown(
      'account',
      '?module=s3bucket&kind=module&account=111&moduleUsageMode=in-stacks',
    );
    const accountModules = screen.getByRole('table', { name: 'Modules and stacks in Development' });
    expect(
      within(within(accountModules).getByRole('row', { name: /s3bucket/ })).getAllByRole('cell')[2],
    ).toHaveTextContent('2');
    expect(
      within(accountModules).getByRole('progressbar', { name: 's3bucket: 2 uses' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Source: Within stacks')).toBeInTheDocument();
    expect(screen.getByText('Uses by account')).toBeInTheDocument();
    expect(screen.getByTitle('2 uses with status failed')).toBeInTheDocument();
    expect(
      screen.getByText(/Showing only Module: s3bucket, Source: Within stacks/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Regions in Development' })).getByRole('link', {
        name: 'eu-west-1',
      }),
    ).toHaveAttribute(
      'href',
      '/infraweave/adoption-health/region-usage?module=s3bucket&kind=module&region=eu-west-1&account=111&moduleUsageMode=in-stacks',
    );

    accountPage.unmount();
    renderBreakdown(
      'region',
      '?module=s3bucket&kind=module&region=eu-west-1&moduleUsageMode=in-stacks',
    );
    const regionModules = screen.getByRole('table', { name: 'Modules and stacks in eu-west-1' });
    expect(
      within(within(regionModules).getByRole('row', { name: /s3bucket/ })).getAllByRole('cell')[2],
    ).toHaveTextContent('2');
    expect(
      within(screen.getByRole('table', { name: 'Accounts in eu-west-1' })).getByRole('link', {
        name: 'Development',
      }),
    ).toHaveAttribute(
      'href',
      '/infraweave/adoption-health/account-usage?module=s3bucket&kind=module&region=eu-west-1&account=111&moduleUsageMode=in-stacks',
    );
  });

  it('opens the deployments of the version named in the URL', () => {
    renderUsage('?module=s3bucket&version=2.0.0');

    expect(
      within(screen.getByRole('dialog', { name: 'Deployments' })).getByText('s3bucket 2.0.0'),
    ).toBeInTheDocument();
  });

  it('drops the version from the URL when another name is selected', async () => {
    const user = userEvent.setup();
    renderUsage('?module=s3bucket&version=2.0.0');

    await user.click(rankingRow('standalone-only'));

    expect(screen.getByTestId('search')).toHaveTextContent('?module=standalone-only');
    expect(screen.getByTestId('search')).not.toHaveTextContent('version=');
  });

  it('warns that within-stack drilldown counts may be incomplete', () => {
    usageMocks.stackIncomplete = true;
    renderBreakdown(
      'account',
      '?module=s3bucket&kind=module&account=111&moduleUsageMode=in-stacks',
    );

    const warning = screen.getByRole('status');
    expect(warning).toHaveTextContent(/usage may be incomplete/i);
    expect(screen.getByText('Counts may be incomplete')).toBeInTheDocument();
  });
});
