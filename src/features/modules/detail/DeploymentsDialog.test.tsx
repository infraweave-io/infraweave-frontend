import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigContext } from '../../../contexts/ConfigContext';
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
  const answer = async (matches: (url: string) => boolean, response: () => Response) => {
    for (let i = pending.length - 1; i >= 0; i--) {
      if (matches(pending[i].url)) pending.splice(i, 1)[0].resolve(response());
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
const isDeployments = (url: string) => url.includes('/deployments/module/');

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
