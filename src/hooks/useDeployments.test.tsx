import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { ConfigContext } from '../contexts/ConfigContext';
import { Project } from '../types/Deployment';
import { clearDeploymentListCache } from '../utils/deploymentListCache';
import { useDeployments } from './useDeployments';

type Pending = { url: string; resolve: (response: Response) => void };

/** Every request waits until the test answers it. */
const setup = () => {
  const pending: Pending[] = [];
  const config = {
    backendBaseUrl: '',
    getString: () => '',
    getApiUrl: (path: string) => `/${path}`,
    fetch: (input: RequestInfo | URL) =>
      new Promise<Response>((resolve) => pending.push({ url: String(input), resolve })),
  };
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ConfigContext.Provider value={{ config: config as any, isStandalone: true }}>
      {children}
    </ConfigContext.Provider>
  );
  const answer = async (matches: (url: string) => boolean, rows: unknown[], status = 200) => {
    for (let i = pending.length - 1; i >= 0; i--) {
      if (matches(pending[i].url)) {
        pending.splice(i, 1)[0].resolve(new Response(JSON.stringify(rows), { status }));
      }
    }
    await act(async () => {});
  };
  return { pending, wrapper, answer };
};

const PROJECTS = [
  { project_id: '111', name: 'acct-a', regions: ['us-west-2', 'eu-central-1'] },
] as unknown as Project[];
const NAMES = ['acct-a'];

describe('useDeployments', () => {
  beforeEach(() => {
    localStorage.clear();
    clearDeploymentListCache();
    // Only a known user's lists are cached; see deploymentListCache.
    localStorage.setItem('auth_token', 'disabled_auth_dummy_token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the rows on screen while the minute poll refreshes them', async () => {
    vi.useFakeTimers();
    const t = setup();
    const regions = ['us-west-2'];
    const { result } = renderHook(() => useDeployments(PROJECTS, NAMES, regions), {
      wrapper: t.wrapper,
    });
    await t.answer(() => true, [{ deployment_id: 'first' }]);
    expect(result.current.loading).toBe(false);

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(t.pending).toHaveLength(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    expect(result.current.deployments.map((d) => d.deployment_id)).toEqual(['first']);
  });

  it('draws the last list for a selection at once and refreshes it in place', async () => {
    const regions = ['us-west-2'];
    const first = setup();
    const mounted = renderHook(() => useDeployments(PROJECTS, NAMES, regions), {
      wrapper: first.wrapper,
    });
    expect(mounted.result.current.loading).toBe(true);
    expect(mounted.result.current.refreshing).toBe(false);
    await first.answer(() => true, [{ deployment_id: 'old' }]);
    mounted.unmount();

    const t = setup();
    const { result } = renderHook(() => useDeployments(PROJECTS, NAMES, regions), {
      wrapper: t.wrapper,
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    expect(result.current.deployments.map((d) => d.deployment_id)).toEqual(['old']);

    await t.answer(() => true, [{ deployment_id: 'new' }]);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.deployments.map((d) => d.deployment_id)).toEqual(['new']);
  });

  it('keeps the cached list when a refresh gets no answer at all', async () => {
    const regions = ['us-west-2'];
    const first = setup();
    const mounted = renderHook(() => useDeployments(PROJECTS, NAMES, regions), {
      wrapper: first.wrapper,
    });
    await first.answer(() => true, [{ deployment_id: 'kept' }]);
    mounted.unmount();

    const offline = setup();
    const again = renderHook(() => useDeployments(PROJECTS, NAMES, regions), {
      wrapper: offline.wrapper,
    });
    await offline.answer(() => true, [], 503);
    expect(again.result.current.incomplete).toBe('request-failed');
    again.unmount();

    const t = setup();
    const { result } = renderHook(() => useDeployments(PROJECTS, NAMES, regions), {
      wrapper: t.wrapper,
    });
    expect(result.current.deployments.map((d) => d.deployment_id)).toEqual(['kept']);
  });

  it('does not draw the list of another selection from the cache', async () => {
    const first = setup();
    const west = ['us-west-2'];
    const mounted = renderHook(() => useDeployments(PROJECTS, NAMES, west), {
      wrapper: first.wrapper,
    });
    await first.answer(() => true, [{ deployment_id: 'west' }]);
    mounted.unmount();

    const t = setup();
    const central = ['eu-central-1'];
    const { result } = renderHook(() => useDeployments(PROJECTS, NAMES, central), {
      wrapper: t.wrapper,
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.deployments).toEqual([]);
  });

  it('does not let a load the filters replaced overwrite the newer one', async () => {
    const t = setup();
    const west = ['us-west-2'];
    const central = ['eu-central-1'];
    const { result, rerender } = renderHook(
      ({ regions }) => useDeployments(PROJECTS, NAMES, regions),
      { wrapper: t.wrapper, initialProps: { regions: west } },
    );

    rerender({ regions: central });
    await t.answer((url) => url.endsWith('/eu-central-1'), [{ deployment_id: 'central' }]);
    await t.answer((url) => url.endsWith('/us-west-2'), [{ deployment_id: 'west' }]);

    expect(result.current.deployments.map((d) => d.deployment_id)).toEqual(['central']);
  });
});
