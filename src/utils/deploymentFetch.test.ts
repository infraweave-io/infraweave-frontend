import {
  batchProjectIds,
  fetchDeployments,
  fetchModulesGlobally,
  mapWithConcurrency,
} from './deploymentFetch';

const accounts = (count: number) =>
  Array.from({ length: count }, (_, i) => String(100000000000 + i));

// Both callbacks get the path with its query string. A null next token ends the collection.
const makeConfig = (
  respond: (path: string) => unknown = () => [],
  nextTokenFor: (path: string) => string | null = () => null,
) => {
  const paths: string[] = [];
  return {
    paths,
    getApiUrl: (path: string) => `https://example.test/${path}`,
    fetch: (input: RequestInfo | URL) => {
      const path = String(input).replace('https://example.test/', '');
      paths.push(path);
      const nextToken = nextTokenFor(path);
      return Promise.resolve({
        ok: true,
        headers: new Headers(nextToken ? { 'x-next-token': nextToken } : {}),
        json: () => Promise.resolve(respond(path)),
      } as Response);
    },
  };
};

describe('batchProjectIds', () => {
  it('keeps a short account list in a single request', () => {
    expect(batchProjectIds(accounts(3))).toHaveLength(1);
  });

  it('splits a long account list', () => {
    const batches = batchProjectIds(accounts(25));
    expect(batches.map((batch) => batch.length)).toEqual([10, 10, 5]);
    expect(batches.flat()).toEqual(accounts(25));
  });

  it('has no batches for no accounts', () => {
    expect(batchProjectIds([])).toEqual([]);
  });
});

describe('mapWithConcurrency', () => {
  it('never exceeds the limit and preserves input order', async () => {
    let inFlight = 0;
    let peak = 0;

    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return n * 2;
    });

    expect(peak).toBeLessThanOrEqual(3);
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });
});

describe('fetchDeployments', () => {
  it('splits a large account list across requests, per region', async () => {
    const config = makeConfig();

    await fetchDeployments(config, {
      projectIds: accounts(25),
      regions: ['us-west-2', 'eu-central-1'],
    });

    // 3 account batches x 2 regions.
    expect(config.paths).toHaveLength(6);
    for (const path of config.paths) {
      const projects = path.split('/api/v1/deployments/')[1].split('/')[0];
      expect(projects.split(',').length).toBeLessThanOrEqual(10);
    }
  });

  it('concatenates the batches into one list', async () => {
    const config = makeConfig((path) => {
      const projects = path.split('/api/v1/deployments/')[1].split('/')[0].split(',');
      return projects.map((project) => ({ project_id: project }));
    });

    const deployments = await fetchDeployments(config, {
      projectIds: accounts(25),
      regions: ['us-west-2'],
    });

    expect(deployments.map((d) => d.project_id)).toEqual(accounts(25));
  });

  it('keeps the accounts that answered when one batch fails', async () => {
    const failing = accounts(25)[0];
    const config = makeConfig();
    const originalFetch = config.fetch;
    const guarded = {
      ...config,
      fetch: (input: RequestInfo | URL) =>
        String(input).includes(failing)
          ? Promise.reject(new Error('503'))
          : originalFetch(input).then(
              () =>
                ({
                  ok: true,
                  headers: new Headers(),
                  json: () => Promise.resolve([{ deployment_id: 'survivor' }]),
                }) as Response,
            ),
    };

    const deployments = await fetchDeployments(guarded, {
      projectIds: accounts(25),
      regions: ['us-west-2'],
    });

    expect(deployments.map((d) => d.deployment_id)).toEqual(['survivor', 'survivor']);
  });

  it('follows x-next-token on the account route', async () => {
    const config = makeConfig(
      (path) => [{ deployment_id: path.includes('next_token') ? 'second' : 'first' }],
      (path) => (path.includes('next_token') ? null : 'page-2'),
    );

    const deployments = await fetchDeployments(config, {
      projectIds: accounts(1),
      regions: ['us-west-2'],
    });

    expect(deployments.map((d) => d.deployment_id)).toEqual(['first', 'second']);
  });

  it('reports a failed account batch as a short list', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = makeConfig();
    const failing = {
      ...config,
      fetch: () => Promise.resolve({ ok: false, status: 503, headers: new Headers() } as Response),
    };
    let incomplete: string | undefined;

    await fetchDeployments(failing, {
      projectIds: accounts(1),
      regions: ['us-west-2'],
      onProgress: (progress) => {
        incomplete = progress.incomplete;
      },
    });

    expect(incomplete).toBe('request-failed');
    warn.mockRestore();
  });

  it('stops asking once aborted', async () => {
    const controller = new AbortController();
    const config = makeConfig(
      () => {
        controller.abort();
        return [{ deployment_id: 'first' }];
      },
      () => 'more',
    );

    await fetchDeployments(config, {
      projectIds: accounts(25),
      regions: ['us-west-2'],
      module: 'argocd',
      signal: controller.signal,
    });

    expect(config.paths).toHaveLength(1);
  });

  it('makes no request when there is nothing to ask for', async () => {
    const config = makeConfig();

    expect(await fetchDeployments(config, { projectIds: [], regions: ['us-west-2'] })).toEqual([]);
    expect(await fetchDeployments(config, { projectIds: accounts(2), regions: [] })).toEqual([]);
    expect(config.paths).toEqual([]);
  });

  describe('narrowed to one module', () => {
    it('asks once per region, with no account list to fan out over', async () => {
      const config = makeConfig();

      await fetchDeployments(config, {
        projectIds: accounts(120),
        regions: ['us-west-2', 'eu-central-1'],
        module: 'argocd',
      });

      expect(config.paths).toEqual([
        'api/proxy/api/infraweave/api/v1/deployments/module/us-west-2/argocd',
        'api/proxy/api/infraweave/api/v1/deployments/module/eu-central-1/argocd',
      ]);
    });

    it('drops rows from accounts the user has not selected', async () => {
      // The endpoint returns every account the token allows, not just the selection.
      const config = makeConfig(() => [
        { project_id: accounts(3)[0], deployment_id: 'selected' },
        { project_id: accounts(3)[2], deployment_id: 'not-selected' },
      ]);

      const deployments = await fetchDeployments(config, {
        projectIds: [accounts(3)[0], accounts(3)[1]],
        regions: ['us-west-2'],
        module: 'argocd',
      });

      expect(deployments.map((d) => d.deployment_id)).toEqual(['selected']);
    });

    it('follows x-next-token to the end of the collection', async () => {
      const config = makeConfig(
        (path) => [
          { project_id: accounts(1)[0], deployment_id: path.includes('page-2') ? 'b' : 'a' },
        ],
        (path) => (path.includes('next_token') ? null : 'page-2'),
      );

      const deployments = await fetchDeployments(config, {
        projectIds: accounts(1),
        regions: ['us-west-2'],
        module: 'argocd',
      });

      expect(config.paths).toHaveLength(2);
      expect(deployments.map((d) => d.deployment_id)).toEqual(['a', 'b']);
    });

    // getApiUrl picks a regional endpoint from a region segment, which a query would hide.
    it('resolves the bare path on every page and adds the token after', async () => {
      const config = makeConfig(
        () => [{ project_id: accounts(1)[0] }],
        (path) => (path.includes('next_token') ? null : 'page-2'),
      );
      const resolved: string[] = [];
      const routed = {
        ...config,
        getApiUrl: (path: string) => {
          resolved.push(path);
          return config.getApiUrl(path);
        },
      };

      await fetchDeployments(routed, {
        projectIds: accounts(1),
        regions: ['us-west-2'],
        module: 'argocd',
      });

      expect(resolved).toEqual([
        'api/proxy/api/infraweave/api/v1/deployments/module/us-west-2/argocd',
        'api/proxy/api/infraweave/api/v1/deployments/module/us-west-2/argocd',
      ]);
      expect(config.paths[1]).toBe(
        'api/proxy/api/infraweave/api/v1/deployments/module/us-west-2/argocd?next_token=page-2',
      );
    });

    it('keeps paging past a page that filtered down to nothing', async () => {
      const config = makeConfig(
        (path) => (path.includes('next_token') ? [{ project_id: accounts(1)[0] }] : []),
        (path) => (path.includes('next_token') ? null : 'page-2'),
      );

      const deployments = await fetchDeployments(config, {
        projectIds: accounts(1),
        regions: ['us-west-2'],
        module: 'argocd',
      });

      expect(deployments).toHaveLength(1);
    });

    it('stops instead of looping when the token never advances', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = makeConfig(
        () => [{ project_id: accounts(1)[0] }],
        () => 'stuck',
      );

      const deployments = await fetchDeployments(config, {
        projectIds: accounts(1),
        regions: ['us-west-2'],
        module: 'argocd',
      });

      expect(config.paths).toHaveLength(2);
      // The repeated page must not be counted twice.
      expect(deployments).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('repeated next_token'));
      warn.mockRestore();
    });

    it('reports rows as each page arrives, and the full list at the end', async () => {
      const config = makeConfig(
        (path) => [
          { project_id: accounts(1)[0], deployment_id: path.includes('page-2') ? 'b' : 'a' },
        ],
        (path) => (path.includes('next_token') ? null : 'page-2'),
      );

      const progress: string[][] = [];
      const deployments = await fetchDeployments(config, {
        projectIds: accounts(1),
        regions: ['us-west-2'],
        module: 'argocd',
        onProgress: ({ deployments: loaded }) =>
          progress.push(loaded.map((d) => String(d.deployment_id))),
      });

      // Page 1, page 2, final report. Each is cumulative.
      expect(progress).toEqual([['a'], ['a', 'b'], ['a', 'b']]);
      expect(deployments.map((d) => d.deployment_id)).toEqual(['a', 'b']);
    });

    it('hands out a new array each time, so a caller holding it in state sees the change', async () => {
      const config = makeConfig(
        () => [{ project_id: accounts(1)[0] }],
        (path) => (path.includes('next_token') ? null : 'page-2'),
      );

      const snapshots: unknown[] = [];
      await fetchDeployments(config, {
        projectIds: accounts(1),
        regions: ['us-west-2'],
        module: 'argocd',
        onProgress: ({ deployments: loaded }) => snapshots.push(loaded),
      });

      expect(new Set(snapshots).size).toBe(snapshots.length);
    });

    it('says nothing is missing when every page arrived', async () => {
      const config = makeConfig(() => [{ project_id: accounts(1)[0] }]);

      let last: { incomplete?: string } = {};
      await fetchDeployments(config, {
        projectIds: accounts(1),
        regions: ['us-west-2'],
        module: 'argocd',
        onProgress: (progress) => {
          last = progress;
        },
      });

      expect(last.incomplete).toBeUndefined();
    });

    it('reports a failed request as a short list', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = makeConfig();
      const guarded = {
        ...config,
        fetch: () => Promise.reject(new Error('503')),
      };

      let last: { incomplete?: string } = {};
      await fetchDeployments(guarded, {
        projectIds: accounts(1),
        regions: ['us-west-2'],
        module: 'argocd',
        onProgress: (progress) => {
          last = progress;
        },
      });

      expect(last.incomplete).toBe('request-failed');
      warn.mockRestore();
    });

    it('reports a response that is not a list as a failed request', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = makeConfig(() => ({ message: 'Service Unavailable' }));

      let last: { incomplete?: string } = {};
      await fetchDeployments(config, {
        projectIds: accounts(1),
        regions: ['us-west-2'],
        module: 'argocd',
        onProgress: (progress) => {
          last = progress;
        },
      });

      expect(last.incomplete).toBe('request-failed');
      warn.mockRestore();
    });

    it('reports a stuck pagination token as a short list', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = makeConfig(
        () => [{ project_id: accounts(1)[0] }],
        () => 'stuck',
      );

      let last: { incomplete?: string } = {};
      await fetchDeployments(config, {
        projectIds: accounts(1),
        regions: ['us-west-2'],
        module: 'argocd',
        onProgress: (progress) => {
          last = progress;
        },
      });

      expect(last.incomplete).toBe('repeated-token');
      warn.mockRestore();
    });

    it('reports a short list when only one of several regions failed', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const config = makeConfig(() => [{ project_id: accounts(1)[0], deployment_id: 'survivor' }]);
      const originalFetch = config.fetch;
      const guarded = {
        ...config,
        fetch: (input: RequestInfo | URL) =>
          String(input).includes('eu-central-1')
            ? Promise.reject(new Error('503'))
            : originalFetch(input),
      };

      let last: { incomplete?: string; deployments?: unknown[] } = {};
      await fetchDeployments(guarded, {
        projectIds: accounts(1),
        regions: ['us-west-2', 'eu-central-1'],
        module: 'argocd',
        onProgress: (progress) => {
          last = progress;
        },
      });

      expect(last.incomplete).toBe('request-failed');
      expect(last.deployments).toHaveLength(1);
      warn.mockRestore();
    });

    it('keeps the regions that answered when one fails', async () => {
      const config = makeConfig(() => [{ project_id: accounts(1)[0], deployment_id: 'survivor' }]);
      const originalFetch = config.fetch;
      const guarded = {
        ...config,
        fetch: (input: RequestInfo | URL) =>
          String(input).includes('eu-central-1')
            ? Promise.reject(new Error('503'))
            : originalFetch(input),
      };

      const deployments = await fetchDeployments(guarded, {
        projectIds: accounts(1),
        regions: ['us-west-2', 'eu-central-1'],
        module: 'argocd',
      });

      expect(deployments.map((d) => d.deployment_id)).toEqual(['survivor']);
    });
  });
});

describe('fetchModulesGlobally', () => {
  it('asks once per module and region, whatever the number of accounts', async () => {
    const config = makeConfig();

    await fetchModulesGlobally(config, {
      modules: ['argocd', 'network/vpc'],
      regions: ['us-west-2', 'eu-central-1'],
    });

    expect(config.paths.sort()).toEqual(
      [
        'api/proxy/api/infraweave/api/v1/deployments/module/us-west-2/argocd',
        'api/proxy/api/infraweave/api/v1/deployments/module/eu-central-1/argocd',
        // A name with a slash stays one path segment.
        'api/proxy/api/infraweave/api/v1/deployments/module/us-west-2/network%2Fvpc',
        'api/proxy/api/infraweave/api/v1/deployments/module/eu-central-1/network%2Fvpc',
      ].sort(),
    );
  });

  it('keeps every account the endpoint returns when no accounts are given', async () => {
    const config = makeConfig(() => [
      { project_id: accounts(2)[0] },
      { project_id: accounts(2)[1] },
    ]);

    const deployments = await fetchModulesGlobally(config, {
      modules: ['argocd'],
      regions: ['us-west-2'],
    });

    expect(deployments.map((d) => d.project_id)).toEqual(accounts(2));
  });

  it('reports one module coming up short as a short fleet', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = makeConfig(() => [{ project_id: accounts(1)[0], deployment_id: 'survivor' }]);
    const originalFetch = config.fetch;
    const guarded = {
      ...config,
      fetch: (input: RequestInfo | URL) =>
        String(input).endsWith('/network')
          ? Promise.reject(new Error('503'))
          : originalFetch(input),
    };

    let last: { incomplete?: string; deployments?: unknown[] } = {};
    await fetchModulesGlobally(guarded, {
      modules: ['argocd', 'network'],
      regions: ['us-west-2'],
      onProgress: (progress) => {
        last = progress;
      },
    });

    expect(last.incomplete).toBe('request-failed');
    expect(last.deployments).toHaveLength(1);
    warn.mockRestore();
  });

  it('makes no request when there is nothing to ask for', async () => {
    const config = makeConfig();

    expect(await fetchModulesGlobally(config, { modules: [], regions: ['us-west-2'] })).toEqual([]);
    expect(await fetchModulesGlobally(config, { modules: ['argocd'], regions: [] })).toEqual([]);
    expect(config.paths).toEqual([]);
  });
});
