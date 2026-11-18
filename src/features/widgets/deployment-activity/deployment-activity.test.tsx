import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Deployment } from '../../../types/Deployment';
import { Project } from '../../../types/Project';
import { FleetDeployments } from '../../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { clearQueryCache } from '../../../utils/queryCache';
import { WidgetIdContext } from '../widgetSettings';
import { LatestAppliesList, LatestPlansList } from './deployment-activity';

const inputs: {
  fleet: Partial<FleetDeployments>;
  projects: Project[];
  respond: (url: string) => Promise<Response>;
} = { fleet: {}, projects: [], respond: () => Promise.reject(new Error('unused')) };

vi.mock('../../adoption-health/AdoptionHealthPage/useFleetDeployments', () => ({
  useFleetDeployments: (): FleetDeployments => ({
    moduleCatalogue: [],
    stackCatalogue: [],
    projectNames: { '111111111111': 'Sandbox' },
    projectRegions: {},
    regions: ['us-west-2'],
    deployments: [],
    fetchedAt: Date.now(),
    loadingCatalog: false,
    catalogueIncomplete: false,
    accessKnown: true,
    nothingToLoad: false,
    loadingDeployments: false,
    loadFailed: false,
    error: null,
    refresh: () => Promise.resolve(),
    ...inputs.fleet,
  }),
}));
vi.mock('../../../hooks/useProjects', () => ({
  useProjects: () => ({ projects: inputs.projects, loading: false }),
}));
vi.mock('../../../hooks/useConfig', () => ({
  useConfig: () => ({
    getApiUrl: (path: string) => `https://example.test/${path}`,
    fetch: (url: string) => inputs.respond(url),
  }),
}));

const deployment = (overrides: Partial<Deployment>): Deployment =>
  ({
    project_id: '111111111111',
    region: 'us-west-2',
    environment: 'dev',
    deployment_id: 'one',
    module: 'vpc',
    module_type: 'module',
    status: 'successful',
    error_text: '',
    job_id: 'job-1',
    epoch: Date.now() - 60 * 60 * 1000,
    ...overrides,
  }) as Deployment;

const renderWidget = (widget: React.ReactElement, id = 'latest') =>
  render(
    <MemoryRouter>
      <WidgetIdContext.Provider value={id}>{widget}</WidgetIdContext.Provider>
    </MemoryRouter>,
  );

const rowNames = () =>
  screen
    .getAllByRole('link')
    .map((link) => link.textContent)
    .filter(Boolean);

describe('LatestAppliesList', () => {
  beforeEach(() => {
    localStorage.clear();
    // Auth disabled stands for one known user, so widget settings are kept.
    localStorage.setItem('auth_token', 'disabled_auth_dummy_token');
    inputs.fleet = {
      deployments: [
        deployment({ deployment_id: 'old-vpc', epoch: Date.now() - 3 * 60 * 60 * 1000 }),
        deployment({ deployment_id: 'new-vpc', epoch: Date.now() - 60 * 1000 }),
        deployment({
          deployment_id: 'broken-stack',
          module: 'platform',
          module_type: 'stack',
          status: 'failed',
          epoch: Date.now() - 2 * 60 * 60 * 1000,
        }),
      ],
    };
  });

  it('lists the newest first', () => {
    renderWidget(<LatestAppliesList />);
    expect(rowNames()).toEqual(['new-vpc', 'broken-stack', 'old-vpc']);
  });

  it('narrows to the picked modules and stacks, and keeps the pick', async () => {
    const first = renderWidget(<LatestAppliesList />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Modules & stacks' }));
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Stacks')).toBeInTheDocument();
    await userEvent.click(within(listbox).getByRole('option', { name: 'platform' }));

    expect(rowNames()).toEqual(['broken-stack']);
    expect(screen.getByRole('status')).toHaveTextContent('1 matching applies');
    first.unmount();

    renderWidget(<LatestAppliesList />);
    expect(rowNames()).toEqual(['broken-stack']);
  });

  it('filters by status, counting error text as failed', async () => {
    inputs.fleet.deployments = [
      ...inputs.fleet.deployments!,
      deployment({ deployment_id: 'odd', error_text: 'boom', status: 'done' }),
    ];
    renderWidget(<LatestAppliesList />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    await userEvent.click(screen.getByRole('option', { name: 'Failed' }));

    expect(rowNames()).toEqual(['odd', 'broken-stack']);
  });

  it('offers a way out when nothing matches', async () => {
    localStorage.setItem(
      'infraweave.widgetSettings.v1',
      JSON.stringify({
        owner: 'auth-disabled',
        value: { latest: { modules: ['vpc'], status: 'in-progress' } },
      }),
    );
    renderWidget(<LatestAppliesList />);

    expect(screen.getByText('No applies match these filters.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(rowNames()).toHaveLength(3);
  });
});

describe('LatestPlansList', () => {
  beforeEach(() => {
    localStorage.clear();
    // Auth disabled stands for one known user, so widget settings are kept.
    localStorage.setItem('auth_token', 'disabled_auth_dummy_token');
    clearQueryCache();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    inputs.projects = [
      { project_id: '111111111111', name: 'Sandbox', regions: ['us-west-2'] } as Project,
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const answer = (body: unknown) =>
    Promise.resolve({
      ok: true,
      headers: new Headers(),
      json: () => Promise.resolve(body),
    } as Response);

  it('links each plan to its changes', async () => {
    inputs.respond = () =>
      answer({ Items: [deployment({ deployment_id: 'planned', job_id: 'plan-9' })] });
    renderWidget(<LatestPlansList />);

    const link = await screen.findByRole('link', { name: 'planned' });
    expect(link).toHaveAttribute(
      'href',
      '/infraweave/deployment/111111111111/us-west-2/dev/planned/events?job=plan-9&view=changes&type=plan',
    );
  });

  it('shows an error when no account answers', async () => {
    inputs.respond = () => Promise.reject(new Error('offline'));
    renderWidget(<LatestPlansList />);

    expect(await screen.findByText(/plan history could not be loaded/)).toBeInTheDocument();
  });

  it('says when there are no accounts to ask', () => {
    inputs.projects = [{ project_id: '111111111111', name: 'Sandbox', regions: [] } as Project];
    renderWidget(<LatestPlansList />);

    expect(screen.getByText(/no plans to show/)).toBeInTheDocument();
  });
});
