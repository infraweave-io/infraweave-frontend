import React from 'react';
import { cleanup, configure, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ConfigContext } from '../../../contexts/ConfigContext';
import type { Deployment, StackModuleUsage } from '../../../types/Deployment';
import { DeploymentExplorerTable } from './DeploymentExplorerTable';
import { vi } from 'vitest';

// The grid renders many rows in happy-dom. Slow CI runners need more time than the defaults.
vi.setConfig({ testTimeout: 20_000 });
configure({ asyncUtilTimeout: 5_000 });

const projects = [
  {
    project_id: 'project-ember',
    name: 'Ember team',
    regions: ['eu-west-1', 'us-east-1'],
  },
  { project_id: 'project-fern', name: 'Fern account', regions: ['us-east-2'] },
  { project_id: 'project-cobalt', name: 'Cobalt platform', regions: ['ap-southeast-2'] },
];

const config = {
  backendBaseUrl: '',
  getString: () => '',
  getApiUrl: (path: string) => `/${path}`,
  fetch: async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith('/projects') ? projects : [];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

const stackUse = (overrides: Partial<StackModuleUsage> = {}): StackModuleUsage => ({
  deployment_id: 'edge-ingress-prod',
  status: 'succeeded',
  project_id: 'project-ember',
  region: 'eu-west-1',
  environment: 'production',
  module: 'networking',
  module_version: '1.4.2',
  module_type: 'module',
  module_track: 'stable',
  drift_detection: { enabled: false, interval: '', auto_remediate: false },
  next_drift_check_epoch: 0,
  initiated_by: 'platform-operator',
  epoch: 1_750_000_000,
  job_id: 'job-edge-ingress-prod',
  variables: {},
  dependencies: [],
  dependants: [],
  reference: 'modules/networking',
  error_text: '',
  output: {},
  has_drifted: false,
  policy_results: [],
  usageSource: 'stack',
  stackName: 'platform-stack',
  stackVersion: '3.2.0',
  componentIndex: 0,
  ...overrides,
});

const uses: StackModuleUsage[] = [
  stackUse(),
  // The same module occurs twice in one stack deployment; it must still render one row.
  stackUse({ componentIndex: 2 }),
  // A deployment ID is only unique within its project and region context.
  stackUse({
    project_id: 'project-fern',
    region: 'us-east-2',
    environment: 'staging',
    status: 'failed',
  }),
  stackUse({
    deployment_id: 'edge-ingress-canary',
    environment: 'staging',
    module_version: '2.1.0',
    stackVersion: '4.0.0',
    componentIndex: 0,
  }),
  stackUse({
    deployment_id: 'policy-engine-prod',
    project_id: 'project-cobalt',
    region: 'ap-southeast-2',
    module: 'policy-engine',
    module_version: '0.8.3',
    stackName: 'security-foundation',
    stackVersion: '2.5.1',
    componentIndex: 0,
  }),
];

const standalone = { ...stackUse(), usageSource: undefined } as unknown as Deployment;

const CurrentSearch = () => <div data-testid="search">{useLocation().search}</div>;

const renderTable = (
  props: Partial<React.ComponentProps<typeof DeploymentExplorerTable>> = {},
  entry = '/',
) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <CurrentSearch />
      <ConfigContext.Provider value={{ config, isStandalone: true }}>
        <DeploymentExplorerTable
          source="both"
          onSourceChange={() => {}}
          stackUses={uses}
          standaloneDeployments={[]}
          filters={{}}
          projectNames={{
            'project-ember': 'Ember team',
            'project-fern': 'Fern account',
            'project-cobalt': 'Cobalt platform',
          }}
          loading={false}
          incomplete={false}
          {...props}
        />
      </ConfigContext.Provider>
    </MemoryRouter>,
  );

const getTable = () => screen.getByRole('table');

const getDeploymentRows = (deploymentId: string) =>
  within(getTable())
    .queryAllByRole('button', { name: `View deployment ${deploymentId}` })
    .map((button) => button.closest('tr'))
    .filter((row): row is HTMLTableRowElement => row !== null);

const findDeploymentRow = (deploymentId: string, account: string, region: string) => {
  const row = getDeploymentRows(deploymentId).find((candidate) => {
    const text = candidate.textContent;
    return text !== null && text.includes(account) && text.includes(region);
  });
  if (!row) throw new Error(`Could not find ${deploymentId} for ${account} in ${region}`);
  return row;
};

describe('DeploymentExplorerTable', () => {
  it('shows deployment context on rows, deduplicates occurrences, and inspects the selected deployment', async () => {
    const user = userEvent.setup();
    renderTable();

    expect(getTable()).toBeInTheDocument();
    const repeatedIdButtons = within(getTable()).getAllByRole('button', {
      name: 'View deployment edge-ingress-prod',
    });
    expect(repeatedIdButtons).toHaveLength(2);

    const emberRow = findDeploymentRow(
      'edge-ingress-prod',
      'Ember team (project-ember)',
      'eu-west-1',
    );
    expect(
      within(emberRow).getByText('Ember team (project-ember)', { exact: true }),
    ).toBeInTheDocument();
    expect(within(emberRow).getByText('eu-west-1', { exact: true })).toBeInTheDocument();
    expect(within(emberRow).getByText('production', { exact: true })).toBeInTheDocument();
    expect(
      within(emberRow).getByRole('button', { name: 'View deployment edge-ingress-prod' }),
    ).toHaveTextContent('edge-ingress-prod');
    expect(within(emberRow).getByText('succeeded', { exact: true })).toBeInTheDocument();

    const fernRow = findDeploymentRow(
      'edge-ingress-prod',
      'Fern account (project-fern)',
      'us-east-2',
    );
    expect(
      within(fernRow).getByText('Fern account (project-fern)', { exact: true }),
    ).toBeInTheDocument();
    expect(within(fernRow).getByText('us-east-2', { exact: true })).toBeInTheDocument();
    expect(within(fernRow).getByText('staging', { exact: true })).toBeInTheDocument();
    expect(within(fernRow).getByText('failed', { exact: true })).toBeInTheDocument();

    await user.click(
      within(emberRow).getByRole('button', { name: 'View deployment edge-ingress-prod' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getAllByRole('heading', { name: 'Deployments using version 1.4.2' }).length,
    ).toBeGreaterThan(0);
    const inspectedDeployment = await within(dialog).findByRole('link', {
      name: 'edge-ingress-prod',
    });
    expect(inspectedDeployment).toHaveAttribute(
      'href',
      '/infraweave/deployment/project-ember/eu-west-1/production/edge-ingress-prod/overview',
    );
    const inspectedRow = inspectedDeployment.closest('tr');
    expect(inspectedRow).not.toBeNull();
    expect(inspectedRow).toHaveTextContent('Ember team');
    expect(inspectedRow).toHaveTextContent('production');
    expect(inspectedRow).toHaveTextContent('eu-west-1');
    // The dialog shows the parent stack name and version in separate columns.
    expect(within(inspectedRow!).getByText('platform-stack', { exact: true })).toBeInTheDocument();
    expect(within(inspectedRow!).getByText('3.2.0', { exact: true })).toBeInTheDocument();
    expect(inspectedRow).toHaveTextContent('succeeded');
  });

  it('applies the account context filter to deployment rows', () => {
    renderTable({ filters: { account: 'project-ember' } });

    expect(getDeploymentRows('edge-ingress-prod')).toHaveLength(1);
    const row = findDeploymentRow('edge-ingress-prod', 'Ember team (project-ember)', 'eu-west-1');
    expect(
      within(row).queryByText('Fern account (project-fern)', { exact: true }),
    ).not.toBeInTheDocument();
  });

  it('applies the region context filter to deployment rows', () => {
    renderTable({ filters: { region: 'us-east-2' } });

    expect(getDeploymentRows('edge-ingress-prod')).toHaveLength(1);
    const row = findDeploymentRow('edge-ingress-prod', 'Fern account (project-fern)', 'us-east-2');
    expect(within(row).getByText('staging', { exact: true })).toBeInTheDocument();
  });

  it('filters rows by account and region columns', async () => {
    const user = userEvent.setup();
    renderTable();

    const accountFilter = screen.getByRole('textbox', {
      name: 'Filter by Account name / project ID',
    });
    await user.type(accountFilter, 'Fern account');
    await waitFor(() => expect(getDeploymentRows('edge-ingress-prod')).toHaveLength(1));
    expect(
      within(
        findDeploymentRow('edge-ingress-prod', 'Fern account (project-fern)', 'us-east-2'),
      ).getByText('failed', { exact: true }),
    ).toBeInTheDocument();

    await user.clear(accountFilter);
    await waitFor(() => expect(getDeploymentRows('edge-ingress-prod')).toHaveLength(2));
    const regionFilter = screen.getByRole('textbox', { name: 'Filter by Region' });
    await user.type(regionFilter, 'eu-west-1');
    await waitFor(() => expect(getDeploymentRows('edge-ingress-prod')).toHaveLength(1));
    const filteredRow = findDeploymentRow(
      'edge-ingress-prod',
      'Ember team (project-ember)',
      'eu-west-1',
    );
    expect(within(filteredRow).getByText('production', { exact: true })).toBeInTheDocument();
  });

  it('filters module versions with a strict greater-than operator', async () => {
    const user = userEvent.setup();
    renderTable();

    const header = within(getTable())
      .getAllByRole('columnheader')
      .find(
        (candidate) =>
          candidate.textContent?.includes('Module version') &&
          within(candidate).queryByRole('combobox') !== null,
      );
    if (!header) throw new Error('Module version filter is missing');
    await user.click(within(header).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '>' }));
    await user.type(within(header).getByRole('textbox'), '1.4.2');

    expect(getDeploymentRows('edge-ingress-canary')).toHaveLength(1);
    expect(getDeploymentRows('edge-ingress-prod')).toHaveLength(0);
  });

  it('applies inclusive stack-version ranges to deployment rows', async () => {
    const user = userEvent.setup();
    renderTable();

    const header = within(getTable())
      .getAllByRole('columnheader')
      .find(
        (candidate) =>
          candidate.textContent?.includes('Stack version') &&
          within(candidate).queryByRole('combobox') !== null,
      );
    if (!header) throw new Error('Stack version filter is missing');
    await user.click(within(header).getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'between' }));
    await user.type(within(header).getByRole('textbox', { name: 'From version' }), '3.2.0');
    await user.type(within(header).getByRole('textbox', { name: 'To version' }), '3.2.0');

    expect(getDeploymentRows('edge-ingress-prod')).toHaveLength(2);
    expect(getDeploymentRows('edge-ingress-canary')).toHaveLength(0);
  });

  it('keeps grouping by a deployment detail column available', async () => {
    const user = userEvent.setup();
    renderTable();

    const accountHeader = within(getTable()).getByRole('columnheader', {
      name: /Account name \/ project ID/,
    });
    await user.click(within(accountHeader).getByRole('button', { name: 'Column Actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Group by Account name / project ID' }));

    const updatedAccountHeader = within(getTable()).getByRole('columnheader', {
      name: /Account name \/ project ID/,
    });
    await user.click(within(updatedAccountHeader).getByRole('button', { name: 'Column Actions' }));
    expect(
      screen.getByRole('menuitem', { name: 'Ungroup by Account name / project ID' }),
    ).toBeInTheDocument();
  });

  it('hides the stack columns for the standalone source and shows them again for others', () => {
    const view = renderTable({
      source: 'standalone',
      stackUses: [],
      standaloneDeployments: [standalone],
    });

    const headers = () =>
      within(getTable())
        .getAllByRole('columnheader')
        .map((h) => h.textContent);
    expect(headers().some((text) => text?.includes('Stack'))).toBe(false);
    expect(within(getTable()).getByText('Module version', { exact: false })).toBeInTheDocument();

    view.rerender(
      <MemoryRouter>
        <ConfigContext.Provider value={{ config, isStandalone: true }}>
          <DeploymentExplorerTable
            source="both"
            onSourceChange={() => {}}
            stackUses={uses}
            standaloneDeployments={[standalone]}
            filters={{}}
            projectNames={{}}
            loading={false}
            incomplete={false}
          />
        </ConfigContext.Provider>
      </MemoryRouter>,
    );
    expect(headers().some((text) => text?.includes('Stack version'))).toBe(true);
  });

  it('writes filters to the URL as the user types', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByRole('textbox', { name: 'Filter by Region' }), 'eu-west-1');

    await waitFor(() =>
      expect(screen.getByTestId('search')).toHaveTextContent('?f.region=eu-west-1'),
    );
  });

  it('restores filters and sorting from the URL', () => {
    renderTable({}, '/?f.region=us-east-2&sort=deploymentId:desc');

    expect(getDeploymentRows('edge-ingress-prod')).toHaveLength(1);
    expect(getDeploymentRows('edge-ingress-canary')).toHaveLength(0);
  });

  it('restores grouping from the URL', async () => {
    const user = userEvent.setup();
    renderTable({}, '/?group=environment');

    const header = within(getTable()).getByRole('columnheader', { name: /Environment/ });
    await user.click(within(header).getByRole('button', { name: 'Column Actions' }));
    expect(screen.getByRole('menuitem', { name: 'Ungroup by Environment' })).toBeInTheDocument();
  });

  it('restores a version filter from the URL', () => {
    renderTable({}, '/?f.moduleVersion=gt:1.4.2');

    expect(getDeploymentRows('edge-ingress-canary')).toHaveLength(1);
    expect(getDeploymentRows('edge-ingress-prod')).toHaveLength(0);
  });

  it('restores hidden columns from the URL', () => {
    renderTable({}, '/?hide=region,status');

    const headers = within(getTable())
      .getAllByRole('columnheader')
      .map((header) => header.textContent ?? '');
    expect(headers.some((text) => text.includes('Region'))).toBe(false);
    expect(headers.some((text) => text.includes('Status'))).toBe(false);
    expect(headers.some((text) => text.includes('Environment'))).toBe(true);
  });

  it('writes a hidden column to the URL', async () => {
    const user = userEvent.setup();
    renderTable();

    const header = within(getTable()).getByRole('columnheader', { name: /Environment/ });
    await user.click(within(header).getByRole('button', { name: 'Column Actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Hide Environment column' }));

    await waitFor(() =>
      expect(screen.getByTestId('search')).toHaveTextContent('?hide=environment'),
    );
  });

  it('keeps the stack columns out of the URL while the standalone source hides them', async () => {
    const user = userEvent.setup();
    renderTable(
      { source: 'standalone', stackUses: [], standaloneDeployments: [standalone] },
      '/?hide=stackName,region',
    );

    const header = within(getTable()).getByRole('columnheader', { name: /Environment/ });
    await user.click(within(header).getByRole('button', { name: 'Column Actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Hide Environment column' }));

    await waitFor(() =>
      expect(screen.getByTestId('search')).toHaveTextContent('?hide=region%2Cenvironment'),
    );
    const headers = within(getTable())
      .getAllByRole('columnheader')
      .map((candidate) => candidate.textContent ?? '');
    expect(headers.some((text) => text.includes('Stack'))).toBe(false);
  });

  it('restores the row density from the URL', () => {
    renderTable({}, '/?density=spacious');

    expect(screen.getByRole('button', { name: 'Toggle density' })).toBeInTheDocument();
    const cell = within(getTable()).getAllByRole('cell')[0];
    const spacious = getComputedStyle(cell).padding;

    cleanup();
    renderTable({}, '/');
    expect(getComputedStyle(within(getTable()).getAllByRole('cell')[0]).padding).not.toBe(spacious);
  });

  it('writes a density change to the URL', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole('button', { name: 'Toggle density' }));

    await waitFor(() =>
      expect(screen.getByTestId('search')).toHaveTextContent('?density=spacious'),
    );
  });

  describe('pagination in the URL', () => {
    const manyUses = Array.from({ length: 60 }, (_, index) =>
      stackUse({ deployment_id: `dep-${String(index).padStart(2, '0')}`, componentIndex: 0 }),
    );

    it('keeps the page the user moves to', async () => {
      const user = userEvent.setup();
      renderTable({ stackUses: manyUses });

      await user.click(screen.getByRole('button', { name: /go to next page/i }));

      await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('page=2'));
      // Give a spurious page reset the chance to run.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(screen.getByTestId('search')).toHaveTextContent('page=2');
    });

    it('keeps a bookmarked page when the fleet finishes loading', async () => {
      const view = renderTable({ stackUses: [], loading: true }, '/?page=2');
      const rerender = (props: Partial<React.ComponentProps<typeof DeploymentExplorerTable>>) =>
        view.rerender(
          <MemoryRouter initialEntries={['/?page=2']}>
            <CurrentSearch />
            <ConfigContext.Provider value={{ config, isStandalone: true }}>
              <DeploymentExplorerTable
                source="both"
                onSourceChange={() => {}}
                stackUses={manyUses}
                standaloneDeployments={[]}
                filters={{}}
                projectNames={{}}
                loading={false}
                incomplete={false}
                {...props}
              />
            </ConfigContext.Provider>
          </MemoryRouter>,
        );
      rerender({});

      await waitFor(() => expect(getTable()).toBeInTheDocument());
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(screen.getByTestId('search')).toHaveTextContent('page=2');
      expect(getDeploymentRows('dep-00')).toHaveLength(0);
    });

    it('returns to the first page when the sort changes', async () => {
      const user = userEvent.setup();
      renderTable({ stackUses: manyUses }, '/?page=2');

      await user.click(within(getTable()).getByRole('button', { name: /sort by region/i }));

      await waitFor(() => expect(screen.getByTestId('search')).not.toHaveTextContent('page='));
    });

    it('moves a page past the end back to the last page', async () => {
      renderTable({ stackUses: manyUses }, '/?page=99');

      await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('page=3'));
    });

    it('only offers page sizes that the URL keeps', async () => {
      const user = userEvent.setup();
      renderTable({ stackUses: manyUses });

      await user.click(screen.getByRole('combobox', { name: /rows per page/i }));
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        '5',
        '10',
        '25',
        '50',
        '100',
      ]);

      await user.click(screen.getByRole('option', { name: '50' }));
      await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('pageSize=50'));
      expect(within(getTable()).getAllByRole('button', { name: /^View deployment/ })).toHaveLength(
        50,
      );
    });
  });
});
