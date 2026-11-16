import { act, renderHook } from '@testing-library/react';
import { Project } from '../../../types/Project';
import { loadFleet } from '../../../utils/fleetCache';
import { fetchCatalogue, useFleetDeployments } from './useFleetDeployments';

const hookInputs = vi.hoisted(() => ({ config: undefined as unknown, projects: [] as unknown[] }));

vi.mock('../../../hooks/useConfig', () => ({ useConfig: () => hookInputs.config }));
vi.mock('../../../hooks/useProjects', () => ({
  useProjects: () => ({ projects: hookInputs.projects, loading: false }),
}));
// With the load stubbed the fleet never arrives, so every run of the load effect calls it.
vi.mock('../../../utils/fleetCache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/fleetCache')>()),
  loadFleet: vi.fn(() => Promise.resolve()),
}));

type Page = { body: unknown; next?: string; status?: number };

/** Fake registry: serves `pages[next_token]` for each list and records every requested path. */
const makeConfig = (lists: { modules?: Page[]; stacks?: Page[] | 'fail' }) => {
  const paths: string[] = [];
  return {
    paths,
    getApiUrl: (path: string) => `https://example.test/${path}`,
    fetch: (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      paths.push(url.pathname + url.search);
      const list = url.pathname.endsWith('/stacks') ? lists.stacks : lists.modules;
      if (list === 'fail') return Promise.reject(new Error('unreachable'));
      const pages = list ?? [{ body: [] }];
      const token = url.searchParams.get('next_token');
      const page = pages[token ? Number(token) : 0];
      return Promise.resolve({
        ok: (page.status ?? 200) < 400,
        status: page.status ?? 200,
        headers: new Headers(page.next ? { 'x-next-token': page.next } : {}),
        json: () => Promise.resolve(page.body),
      } as Response);
    },
  } as unknown as Parameters<typeof fetchCatalogue>[0] & { paths: string[] };
};

describe('fetchCatalogue', () => {
  it('follows every page of the module and stack lists', async () => {
    const config = makeConfig({
      modules: [{ body: [{ module: 'vpc' }], next: '1' }, { body: { Items: [{ module: 'iam' }] } }],
      stacks: [{ body: [{ module: 'webapp' }] }],
    });

    const catalogue = await fetchCatalogue(config);

    expect(catalogue.modules.map((m) => m.module)).toEqual(['vpc', 'iam']);
    expect(catalogue.stacks.map((m) => m.module)).toEqual(['webapp']);
    expect(catalogue.complete).toBe(true);
    expect(config.paths.filter((p) => p.includes('/modules'))).toHaveLength(2);
  });

  it('is incomplete, not endless, when a token does not move on', async () => {
    const config = makeConfig({
      modules: [
        { body: [{ module: 'vpc' }], next: '1' },
        { body: [{ module: 'iam' }], next: '1' },
      ],
    });

    const catalogue = await fetchCatalogue(config);

    expect(catalogue.modules.map((m) => m.module)).toEqual(['vpc', 'iam']);
    expect(catalogue.complete).toBe(false);
  });

  it('keeps the modules when the stacks cannot be read, and says the list is short', async () => {
    const config = makeConfig({ modules: [{ body: [{ module: 'vpc' }] }], stacks: 'fail' });

    const catalogue = await fetchCatalogue(config);

    expect(catalogue.modules).toHaveLength(1);
    expect(catalogue.stacks).toEqual([]);
    expect(catalogue.complete).toBe(false);
  });

  it('fails when the module list cannot be read', async () => {
    await expect(
      fetchCatalogue(makeConfig({ modules: [{ body: [], status: 503 }] })),
    ).rejects.toThrow(/HTTP 503/);
  });

  it('fails when a page is not a list', async () => {
    await expect(
      fetchCatalogue(makeConfig({ modules: [{ body: { message: 'Bad gateway' } }] })),
    ).rejects.toThrow(/expected a list/);
  });
});

describe('useFleetDeployments', () => {
  const account = (): Project =>
    ({ project_id: '111111111111', name: 'dev', regions: ['us-east-1'] }) as Project;

  beforeEach(() => {
    vi.mocked(loadFleet).mockClear();
    hookInputs.config = makeConfig({});
    hookInputs.projects = [account()];
  });

  const renderFleet = async () => {
    const hook = renderHook(() => useFleetDeployments());
    await act(async () => {});
    return hook;
  };

  it('does not reload when the project list is republished unchanged', async () => {
    const { rerender } = await renderFleet();
    expect(loadFleet).toHaveBeenCalledTimes(1);

    hookInputs.projects = [account()];
    rerender();
    await act(async () => {});

    expect(loadFleet).toHaveBeenCalledTimes(1);
  });

  it('reloads when the config changes', async () => {
    const { rerender } = await renderFleet();
    expect(loadFleet).toHaveBeenCalledTimes(1);

    hookInputs.config = makeConfig({});
    rerender();
    await act(async () => {});

    expect(loadFleet).toHaveBeenCalledTimes(2);
    expect(vi.mocked(loadFleet).mock.calls[1][0]).toBe(hookInputs.config);
  });
});
