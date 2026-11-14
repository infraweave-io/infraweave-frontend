import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { ConfigContext } from '../contexts/ConfigContext';
import { Project } from '../types/Deployment';
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
  const answer = async (matches: (url: string) => boolean, rows: unknown[]) => {
    for (let i = pending.length - 1; i >= 0; i--) {
      if (matches(pending[i].url)) {
        pending.splice(i, 1)[0].resolve(new Response(JSON.stringify(rows), { status: 200 }));
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
    expect(result.current.deployments.map((d) => d.deployment_id)).toEqual(['first']);
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
