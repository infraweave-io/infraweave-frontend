import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigContext } from '../../../contexts/ConfigContext';
import type { StackModuleUsage } from '../../../types/Deployment';
import { DeploymentsDialog } from './ModuleVersions';

type Pending = { url: string; resolve: (response: Response) => void };

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers });

/** Every request waits until the test answers it. */
const setup = () => {
  const pending: Pending[] = [];
  const requested: string[] = [];
  const config = {
    backendBaseUrl: '',
    getString: () => '',
    getApiUrl: (path: string) => `/${path}`,
    fetch: (input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      return new Promise<Response>((resolve) => pending.push({ url, resolve }));
    },
  };
  const wrap = (ui: React.ReactElement) => (
    <MemoryRouter>
      <ConfigContext.Provider value={{ config: config as any, isStandalone: true }}>
        {ui}
      </ConfigContext.Provider>
    </MemoryRouter>
  );
  const flush = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  const answer = async (matches: (url: string) => boolean, response: (url: string) => Response) => {
    for (let i = pending.length - 1; i >= 0; i--) {
      const request = pending[i];
      if (matches(request.url)) {
        pending.splice(i, 1);
        request.resolve(response(request.url));
      }
    }
    await flush();
  };
  return { requested, wrap, flush, answer };
};

const PROJECTS = [
  { project_id: '111', name: 'acct-a', regions: ['us-west-2'] },
  { project_id: '222', name: 'acct-b', regions: ['us-west-2'] },
];

const isProjects = (url: string) => url.endsWith('/projects');
const isPublishedVersions = (url: string) => url.includes('/modules/versions/');
const isDeployments = (url: string) => url.includes('/deployments/module/');
const STACK_MODULE_USE: StackModuleUsage = {
  deployment_id: 'stack-deployment-1',
  status: 'succeeded',
  project_id: '111',
  region: 'us-west-2',
  environment: 'prod',
  module: 'mod',
  drift_detection: { enabled: false, interval: '', auto_remediate: false },
  next_drift_check_epoch: 0,
  initiated_by: 'test',
  epoch: 0,
  job_id: 'job-1',
  module_version: '2.0.0',
  module_type: 'module',
  module_track: '',
  variables: {},
  dependencies: [],
  dependants: [],
  reference: '',
  error_text: '',
  output: {},
  has_drifted: false,
  policy_results: [],
  usageSource: 'stack',
  stackName: 'parent-stack',
  stackVersion: '1.0.0',
  componentIndex: 0,
};

describe('DeploymentsDialog', () => {
  it('shows a spinner, not an empty list, until the deployments have loaded', async () => {
    const t = setup();
    render(t.wrap(<DeploymentsDialog open onClose={() => {}} moduleName="mod" version="" />));
    await t.flush();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText(/No deployments found/)).not.toBeInTheDocument();

    await t.answer(isProjects, () => json(PROJECTS));
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText(/No deployments found/)).not.toBeInTheDocument();

    await t.answer(isDeployments, () => json([]));
    expect(screen.getByText('No deployments found for this module.')).toBeInTheDocument();
  });

  it.each([
    {
      rowLabel: 'Uses',
      includeDirectDeployments: false,
      emptyState: 'No uses found for this module.',
    },
    {
      rowLabel: 'Deployments and uses',
      includeDirectDeployments: true,
      emptyState: 'No deployments and uses found for this module.',
    },
  ])(
    'uses the $rowLabel label when the list is empty',
    async ({ rowLabel, includeDirectDeployments, emptyState }) => {
      const t = setup();
      render(
        t.wrap(
          <DeploymentsDialog
            open
            onClose={() => {}}
            moduleName="mod"
            version=""
            initialProjectIds={['111']}
            initialRegions={['us-west-2']}
            stackModuleDeployments={[]}
            includeDirectDeployments={includeDirectDeployments}
            rowLabel={rowLabel}
          />,
        ),
      );
      await t.flush();
      await t.answer(isProjects, () => json(PROJECTS));
      if (includeDirectDeployments) await t.answer(isDeployments, () => json([]));

      expect(await screen.findByText(emptyState)).toBeInTheDocument();
    },
  );

  it('shows stack-only uses and filters by the component published track', async () => {
    const t = setup();
    render(
      t.wrap(
        <DeploymentsDialog
          open
          onClose={() => {}}
          moduleName="mod"
          version="2.0.0"
          initialProjectIds={['111']}
          initialRegions={['us-west-2']}
          stackModuleDeployments={[STACK_MODULE_USE]}
        />,
      ),
    );
    await t.flush();
    await t.answer(isProjects, () => json(PROJECTS));
    await t.answer(isPublishedVersions, (url) =>
      json(
        url.includes('/versions/stable/')
          ? [{ module: 'mod', module_name: 'mod', track: 'stable', version: '2.0.0' }]
          : [],
      ),
    );
    await t.answer(isDeployments, () => json([]));

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Tracks' }));
    fireEvent.click(await screen.findByRole('option', { name: 'stable' }));

    expect(screen.getByText('parent-stack')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'stack-deployment-1' })).toHaveAttribute(
      'href',
      '/infraweave/deployment/111/us-west-2/prod/stack-deployment-1/overview',
    );
  });

  it('does not fetch or show direct deployments when only stack uses are wanted', async () => {
    const t = setup();
    render(
      t.wrap(
        <DeploymentsDialog
          open
          onClose={() => {}}
          moduleName="mod"
          version="2.0.0"
          stackModuleDeployments={[STACK_MODULE_USE]}
          includeDirectDeployments={false}
        />,
      ),
    );
    await t.flush();
    await t.answer(isProjects, () => json(PROJECTS));

    expect(t.requested.filter(isDeployments)).toEqual([]);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'stack-deployment-1' })).toBeInTheDocument();
  });

  it('selects nothing for an account the caller asked for that is not visible', async () => {
    const t = setup();
    render(
      t.wrap(
        <DeploymentsDialog
          open
          onClose={() => {}}
          moduleName="mod"
          version=""
          initialProjectIds={['999']}
        />,
      ),
    );
    await t.flush();
    await t.answer(isProjects, () => json(PROJECTS));

    expect(t.requested.filter(isDeployments)).toEqual([]);
    expect(
      screen.getByText('Select at least one project and one region to see deployments.'),
    ).toBeInTheDocument();
  });

  it('stops paging once closed', async () => {
    const t = setup();
    const { unmount } = render(
      t.wrap(<DeploymentsDialog open onClose={() => {}} moduleName="mod" version="" />),
    );
    await t.flush();
    await t.answer(isProjects, () => json(PROJECTS));
    unmount();

    await t.answer(isDeployments, () => json([], { 'x-next-token': 'page-2' }));

    expect(t.requested.filter((url) => url.includes('next_token'))).toEqual([]);
  });
});
