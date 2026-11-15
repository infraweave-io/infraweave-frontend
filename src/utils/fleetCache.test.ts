import { clearFleetCache, getFleetSnapshot, loadFleet, needsFleetLoad } from './fleetCache';

/** Answers the fleet route with `rows`, resolving each request only when released. */
const makeConfig = (rows: unknown[]) => {
  const pending: (() => void)[] = [];
  let requests = 0;
  return {
    get requests() {
      return requests;
    },
    release: () => pending.splice(0).forEach((resolve) => resolve()),
    getApiUrl: (path: string) => `https://example.test/${path}`,
    fetch: () => {
      requests += 1;
      return new Promise<Response>((resolve) => {
        pending.push(() =>
          resolve({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: () => Promise.resolve(rows),
          } as Response),
        );
      });
    },
  };
};

const SCOPE = '111111111111|us-west-2';
const options = { scope: SCOPE, regions: ['us-west-2'], loadModules: async () => [] };

/** Lets the fetch chain run to the point of waiting on the next release. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** An id token for `sub` from `iss`; only its payload is read. */
const tokenFor = (sub: string, iss = 'https://idp.example.test') =>
  `header.${btoa(JSON.stringify({ sub, iss })).replace(/=+$/, '')}.signature`;

const signInAs = (sub: string, iss?: string) =>
  localStorage.setItem('auth_token', tokenFor(sub, iss));

/** Re-imports the module with nothing in memory, as a page reload would. */
const reload = async () => {
  vi.resetModules();
  return import('./fleetCache');
};

const loadRows = async (rows: unknown[], scope = SCOPE) => {
  const config = makeConfig(rows);
  const load = loadFleet(config, { ...options, scope });
  await settle();
  config.release();
  await load;
};

describe('fleetCache', () => {
  beforeEach(() => {
    localStorage.clear();
    clearFleetCache();
    signInAs('alice');
  });

  it('starts empty and in need of a load', () => {
    expect(getFleetSnapshot().deployments).toEqual([]);
    expect(needsFleetLoad(SCOPE)).toBe(true);
  });

  it('stores a loaded fleet, so the next page load draws it at once', async () => {
    await loadRows([{ project_id: 'a', deployment_id: 'd1' }]);

    expect(getFleetSnapshot().deployments).toHaveLength(1);
    expect(needsFleetLoad(SCOPE)).toBe(false);

    const fresh = await reload();
    expect(fresh.getFleetSnapshot().deployments).toHaveLength(1);
  });

  it('does not read a stored fleet back for another user', async () => {
    await loadRows([{ project_id: 'a', deployment_id: 'alices' }]);

    signInAs('bob');
    const fresh = await reload();

    expect(fresh.getFleetSnapshot().deployments).toEqual([]);
    expect(fresh.needsFleetLoad(SCOPE)).toBe(true);
  });

  it('does not read a stored fleet back for the same subject from another provider', async () => {
    await loadRows([{ project_id: 'a', deployment_id: 'first-providers' }]);

    signInAs('alice', 'https://other-idp.example.test');
    const fresh = await reload();

    expect(fresh.getFleetSnapshot().deployments).toEqual([]);
  });

  it.each([
    ['an issuer', { sub: 'alice' }],
    ['a subject', { iss: 'https://idp.example.test', email: 'alice@example.test' }],
  ])('keeps nothing across a reload for a token without %s', async (_, claims) => {
    localStorage.setItem(
      'auth_token',
      `header.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.signature`,
    );
    await loadRows([{ project_id: 'a' }]);

    const fresh = await reload();
    expect(fresh.getFleetSnapshot().deployments).toEqual([]);
    expect(localStorage.getItem('infraweave.fleet.v2')).toBeNull();
  });

  it('keeps nothing across a reload when nobody is signed in', async () => {
    localStorage.removeItem('auth_token');
    await loadRows([{ project_id: 'a' }]);

    const fresh = await reload();
    expect(fresh.getFleetSnapshot().deployments).toEqual([]);
    expect(localStorage.getItem('infraweave.fleet.v2')).toBeNull();
  });

  it('needs a load when the accounts or regions change, however fresh the fleet', async () => {
    await loadRows([{ project_id: 'a' }]);

    expect(needsFleetLoad(SCOPE)).toBe(false);
    expect(needsFleetLoad('111111111111,222222222222|us-west-2')).toBe(true);
  });

  it('treats a fleet that came back short as fresh for a minute only', async () => {
    // eu-central-1 answers, us-west-2 does not.
    const config = {
      getApiUrl: (path: string) => `https://example.test/${path}`,
      fetch: (input: RequestInfo | URL) =>
        Promise.resolve(
          String(input).endsWith('/us-west-2')
            ? ({ ok: false, status: 503, headers: new Headers() } as Response)
            : ({
                ok: true,
                status: 200,
                headers: new Headers(),
                json: () => Promise.resolve([{ project_id: 'a' }]),
              } as Response),
        ),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await loadFleet(config, { ...options, regions: ['us-west-2', 'eu-central-1'] });
    warn.mockRestore();

    const { fetchedAt, incomplete } = getFleetSnapshot();
    expect(incomplete).toBe('request-failed');
    expect(needsFleetLoad(SCOPE, fetchedAt + 30 * 1000)).toBe(false);
    expect(needsFleetLoad(SCOPE, fetchedAt + 61 * 1000)).toBe(true);
    // Timer-driven checks wait the full window.
    expect(needsFleetLoad(SCOPE, fetchedAt + 61 * 1000, false)).toBe(false);
    expect(needsFleetLoad(SCOPE, fetchedAt + 16 * 60 * 1000, false)).toBe(true);
  });

  it('keeps the previous fleet when a refresh gets no answer at all', async () => {
    await loadRows([{ project_id: 'a', deployment_id: 'kept' }]);
    const { fetchedAt } = getFleetSnapshot();
    const offline = {
      getApiUrl: (path: string) => `https://example.test/${path}`,
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await loadFleet(offline, options);
    warn.mockRestore();

    const after = getFleetSnapshot();
    expect(after.deployments.map((d) => d.deployment_id)).toEqual(['kept']);
    expect(after.fetchedAt).toBe(fetchedAt);
    expect(after.failed).toBeDefined();
    const fresh = await reload();
    expect(fresh.getFleetSnapshot().deployments.map((d) => d.deployment_id)).toEqual(['kept']);
  });

  it('keeps the rows of a region whose later page failed, as a short fleet', async () => {
    await loadRows([{ project_id: 'a', deployment_id: 'old' }]);
    const config = {
      getApiUrl: (path: string) => `https://example.test/${path}`,
      fetch: (input: RequestInfo | URL) =>
        Promise.resolve(
          String(input).includes('next_token')
            ? ({ ok: false, status: 503, headers: new Headers() } as Response)
            : ({
                ok: true,
                status: 200,
                headers: new Headers({ 'x-next-token': 'page-2' }),
                json: () => Promise.resolve([{ project_id: 'a', deployment_id: 'page-1' }]),
              } as Response),
        ),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await loadFleet(config, options);
    warn.mockRestore();

    const after = getFleetSnapshot();
    expect(after.deployments.map((d) => d.deployment_id)).toEqual(['page-1']);
    expect(after.incomplete).toBe('request-failed');
    expect(after.failed).toBeUndefined();
  });

  it('waits before retrying a failed load, as for a short one', async () => {
    const offline = {
      getApiUrl: (path: string) => `https://example.test/${path}`,
      fetch: () => Promise.reject(new TypeError('Failed to fetch')),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await loadFleet(offline, options);
    warn.mockRestore();

    const { at } = getFleetSnapshot().failed!;
    expect(needsFleetLoad(SCOPE, at + 30 * 1000)).toBe(false);
    expect(needsFleetLoad(SCOPE, at + 61 * 1000)).toBe(true);
    expect(needsFleetLoad(SCOPE, at + 61 * 1000, false)).toBe(false);
    // A different scope has not been tried yet.
    expect(needsFleetLoad('other|us-west-2', at + 1000)).toBe(true);
  });

  it('stops the requests of a load that another replaced or a clear dropped', async () => {
    const signals: AbortSignal[] = [];
    const recording = {
      getApiUrl: (path: string) => `https://example.test/${path}`,
      fetch: (_: RequestInfo | URL, init?: RequestInit) => {
        signals.push(init!.signal!);
        return new Promise<Response>(() => {});
      },
    };

    loadFleet(recording, options);
    await settle();
    loadFleet(recording, { ...options, scope: 'other|us-west-2' });
    await settle();
    expect(signals.map((signal) => signal.aborted)).toEqual([true, false]);

    clearFleetCache();
    expect(signals[1].aborted).toBe(true);
  });

  it('keeps a complete fleet fresh for the full window', async () => {
    await loadRows([{ project_id: 'a' }]);

    const { fetchedAt } = getFleetSnapshot();
    expect(needsFleetLoad(SCOPE, fetchedAt + 5 * 60 * 1000)).toBe(false);
    expect(needsFleetLoad(SCOPE, fetchedAt + 16 * 60 * 1000)).toBe(true);
  });

  it('joins a load that is already running for the same scope', async () => {
    const config = makeConfig([]);
    const first = loadFleet(config, options);
    const second = loadFleet(config, options);
    expect(second).toBe(first);
    await settle();
    config.release();
    await first;
    expect(config.requests).toBe(1);
  });

  it('drops the result of a load that a load for another scope replaced', async () => {
    const older = makeConfig([{ project_id: 'a', deployment_id: 'old' }]);
    const olderLoad = loadFleet(older, options);
    await settle();

    const newer = makeConfig([{ project_id: 'a', deployment_id: 'new' }]);
    const newerLoad = loadFleet(newer, { ...options, scope: 'other|us-west-2' });
    await settle();
    newer.release();
    await newerLoad;
    older.release();
    await olderLoad;

    expect(getFleetSnapshot().deployments.map((d) => d.deployment_id)).toEqual(['new']);
    expect(getFleetSnapshot().scope).toBe('other|us-west-2');
  });

  it('keeps the previous fleet in place until a refresh finishes', async () => {
    await loadRows([{ project_id: 'a', deployment_id: 'old' }]);

    const after = makeConfig([{ project_id: 'a', deployment_id: 'new' }]);
    const refresh = loadFleet(after, options);
    await settle();
    expect(getFleetSnapshot().loading).toBe(true);
    expect(getFleetSnapshot().deployments.map((d) => d.deployment_id)).toEqual(['old']);

    after.release();
    await refresh;
    expect(getFleetSnapshot().deployments.map((d) => d.deployment_id)).toEqual(['new']);
    expect(getFleetSnapshot().loading).toBe(false);
  });

  it('does not let a load cut short by a clear end the load that replaced it', async () => {
    const stale = makeConfig([]);
    const first = loadFleet(stale, options);
    clearFleetCache();

    const current = makeConfig([]);
    const second = loadFleet(current, options);
    await settle();
    stale.release();
    await first;

    expect(loadFleet(current, options)).toBe(second);
    current.release();
    await second;
  });

  it('drops a load that was running when the cache was cleared', async () => {
    const config = makeConfig([{ project_id: 'a' }]);
    const load = loadFleet(config, options);
    await settle();
    clearFleetCache();
    config.release();
    await load;

    expect(getFleetSnapshot().deployments).toEqual([]);
    expect(localStorage.getItem('infraweave.fleet.v2')).toBeNull();
  });
});
