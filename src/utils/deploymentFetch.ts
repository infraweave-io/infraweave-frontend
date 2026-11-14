import { Deployment } from '../types/Deployment';

// The API runs one query per account in a request, so a long account list gets a 503
// from the gateway. Lists are batched here; the module and fleet routes are token-scoped.

/** Subset of AppConfig, so this is testable without a ConfigProvider. */
type FetchConfig = {
  getApiUrl: (path: string) => string;
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

/** Accounts per request. */
export const PROJECT_BATCH_SIZE = 10;

// Each request still fans out PROJECT_BATCH_SIZE ways on the server, so batching
// alone would just spread the overload across many requests.
const MAX_CONCURRENT_REQUESTS = 6;

// Emergency brake, set high because pages are filtered after a 1MB read and can be
// nearly empty. Reaching it is reported as 'page-limit'.
const MAX_PAGES = 500;

/** Why a result is known to be incomplete. */
export type IncompleteReason = 'page-limit' | 'repeated-token' | 'request-failed';

/** Shared so every view describes a short list the same way. See `ListIncomplete`. */
export const INCOMPLETE_REASON_TEXT: Record<IncompleteReason, string> = {
  'page-limit': 'stopped at the request cap, so deployments past the ones listed are missing',
  'repeated-token': 'stopped early because the API repeated a pagination token',
  'request-failed': 'stopped on a failed request, so some accounts or regions may be missing',
};

/** `incomplete` is only set once every request has finished. */
export type FetchProgress = {
  deployments: Deployment[];
  incomplete?: IncompleteReason;
  /** One entry per region (fleet) or module (per-module), for the loading screen. */
  sources?: SourceProgress[];
  /** Which endpoint is answering. See `fetchFleetDeployments`. */
  mode?: FleetMode;
};

export type SourceState = 'pending' | 'loading' | 'done' | 'failed';

export type SourceProgress = {
  label: string;
  state: SourceState;
  /** Rows kept so far, after the account filter. */
  rows: number;
  requests: number;
};

/** `per-module` is the fallback for a backend without the fleet route. */
export type FleetMode = 'fleet' | 'per-module';

/**
 * Several regions can feed one module, so state is tracked per source. A source is done
 * once all `requestsPerSource` of its requests have finished, not when the ones started so
 * far have, or it would flip back to loading when the next one starts.
 */
const createSourceTracker = (labels: string[], requestsPerSource = 1) => {
  const sources = new Map<string, SourceProgress & { remaining: number; failed: boolean }>(
    labels.map((label) => [
      label,
      {
        label,
        state: 'pending',
        rows: 0,
        requests: 0,
        remaining: requestsPerSource,
        failed: false,
      },
    ]),
  );
  return {
    start: (label: string) => {
      sources.get(label)!.state = 'loading';
    },
    page: (label: string, rows: number) => {
      const source = sources.get(label)!;
      source.rows += rows;
      source.requests += 1;
    },
    finish: (label: string, failed: boolean) => {
      const source = sources.get(label)!;
      source.remaining -= 1;
      source.failed ||= failed;
      if (source.remaining === 0) source.state = source.failed ? 'failed' : 'done';
    },
    snapshot: (): SourceProgress[] =>
      Array.from(sources.values(), ({ label, state, rows, requests }) => ({
        label,
        state,
        rows,
        requests,
      })),
  };
};

export const batchProjectIds = (projectIds: string[], size = PROJECT_BATCH_SIZE): string[][] => {
  const batches: string[][] = [];
  for (let i = 0; i < projectIds.length; i += size) {
    batches.push(projectIds.slice(i, i + size));
  }
  return batches;
};

/** Promise.all with a ceiling on concurrency. Results stay in input order. */
export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

const accountDeploymentsPath = (projectIds: string[], region: string): string =>
  `api/proxy/api/infraweave/api/v1/deployments/${projectIds.join(',')}/${region}`;

/** Token-scoped and backed by a cross-account index, so there is no per-account fan-out. */
const globalModulePath = (region: string, module: string): string =>
  `api/proxy/api/infraweave/api/v1/deployments/module/${region}/${encodeURIComponent(module)}`;

/** Every deployment in one region, token-scoped. */
const fleetPath = (region: string): string =>
  `api/proxy/api/infraweave/api/v1/fleet/deployments/${region}`;

const withNextToken = (path: string, nextToken: string): string =>
  `${path}${path.includes('?') ? '&' : '?'}next_token=${encodeURIComponent(nextToken)}`;

/**
 * Only a missing token ends the collection: the backend filters after reading, so a page
 * can be empty with more behind it. Returns why it stopped short, or undefined.
 */
const fetchAllPages = async (
  config: FetchConfig,
  path: string,
  onPage: (rows: Deployment[]) => void,
  signal?: AbortSignal,
): Promise<IncompleteReason | 'not-found' | undefined> => {
  let nextToken: string | null = null;
  let collected = 0;
  // Guards against a backend that keeps returning the same token.
  const seenTokens = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page++) {
    // The caller has moved on and ignores the result, so stop asking.
    if (signal?.aborted) return 'request-failed';
    try {
      // getApiUrl picks a regional endpoint from a region segment in the path, which a
      // trailing query would hide, so the token goes on after resolving.
      const base = config.getApiUrl(path);
      const url = nextToken ? withNextToken(base, nextToken) : base;
      const response = await config.fetch(url, { signal });
      // Route missing. The fleet fetch falls back instead of reporting a short list.
      if (response.status === 404 && page === 0) return 'not-found';
      if (!response.ok) {
        console.warn(`Failed to fetch deployments from ${path}: HTTP ${response.status}`);
        return 'request-failed';
      }

      const token = response.headers.get('x-next-token');
      // Checked before onPage, or the repeated page would be counted twice.
      if (token && seenTokens.has(token)) {
        console.warn(`Backend returned a repeated next_token for ${path}; stopping`);
        return 'repeated-token';
      }

      const json = await response.json();
      const pageItems = json?.Items ?? json?.items ?? json;
      // A proxy error body must not pass as an empty, complete page.
      if (!Array.isArray(pageItems)) {
        console.warn(`Unexpected response from ${path}: expected a list of deployments`);
        return 'request-failed';
      }
      const rows = pageItems as Deployment[];
      collected += rows.length;
      onPage(rows);

      nextToken = token;
      if (!nextToken) return undefined;
      seenTokens.add(nextToken);
    } catch (err) {
      if (!signal?.aborted) console.warn(`Failed to fetch deployments from ${path}`, err);
      return 'request-failed';
    }
  }

  console.warn(
    `Stopped loading ${path} after ${MAX_PAGES} pages (${collected} deployments); the list may be incomplete`,
  );
  return 'page-limit';
};

/**
 * Summary rows for the given modules in every account the token grants, or only
 * `projectIds` when given. Modules no longer in the registry are not found.
 */
export const fetchModulesGlobally = async (
  config: FetchConfig,
  {
    modules,
    regions,
    projectIds,
    onProgress,
    signal,
  }: {
    modules: string[];
    regions: string[];
    projectIds?: string[];
    /** Same contract as in `fetchDeployments`. */
    onProgress?: (progress: FetchProgress) => void;
    /** Stops further requests; the partial result is then of no use to the caller. */
    signal?: AbortSignal;
  },
): Promise<Deployment[]> => {
  if (modules.length === 0 || regions.length === 0) return [];

  const selected = projectIds ? new Set(projectIds) : undefined;
  const collected: Deployment[] = [];
  const tracker = createSourceTracker(modules, regions.length);
  // New array each time so a caller holding it in state sees the change.
  const report = (incomplete?: IncompleteReason) =>
    onProgress?.({
      deployments: [...collected],
      incomplete,
      sources: tracker.snapshot(),
      mode: 'per-module',
    });

  // Each region has its own deployments table.
  const requests = modules.flatMap((module) => regions.map((region) => ({ module, region })));

  // Once `signal` aborts, each remaining request returns without asking the API.
  const reasons = await mapWithConcurrency(requests, MAX_CONCURRENT_REQUESTS, async (request) => {
    tracker.start(request.module);
    report();
    const reason = await fetchAllPages(
      config,
      globalModulePath(request.region, request.module),
      (rows) => {
        const kept = rows.filter((d) => !selected || selected.has(d.project_id));
        collected.push(...kept);
        tracker.page(request.module, kept.length);
        report();
      },
      signal,
    );
    tracker.finish(request.module, Boolean(reason));
    report();
    // No fallback for this route, so a 404 is a failure.
    return reason === 'not-found' ? 'request-failed' : reason;
  });

  report(reasons.find(Boolean));
  return collected;
};

/**
 * Summary rows for every account the token grants, one request per region. Falls back to
 * per-module requests when the fleet route 404s; `loadModules` is only called then.
 */
export const fetchFleetDeployments = async (
  config: FetchConfig,
  {
    regions,
    loadModules,
    onProgress,
    signal,
  }: {
    regions: string[];
    loadModules: () => Promise<string[]>;
    onProgress?: (progress: FetchProgress) => void;
    signal?: AbortSignal;
  },
): Promise<FetchProgress> => {
  if (regions.length === 0) return { deployments: [], mode: 'fleet' };

  const collected: Deployment[] = [];
  const tracker = createSourceTracker(regions);
  const report = (incomplete?: IncompleteReason): FetchProgress => {
    const progress: FetchProgress = {
      deployments: [...collected],
      incomplete,
      sources: tracker.snapshot(),
      mode: 'fleet',
    };
    onProgress?.(progress);
    return progress;
  };

  const outcomes = await mapWithConcurrency(regions, MAX_CONCURRENT_REQUESTS, async (region) => {
    tracker.start(region);
    // Report now so the loading screen lists the region before it answers.
    report();
    const outcome = await fetchAllPages(
      config,
      fleetPath(region),
      (rows) => {
        collected.push(...rows);
        tracker.page(region, rows.length);
        report();
      },
      signal,
    );
    tracker.finish(region, Boolean(outcome));
    report();
    return outcome;
  });

  if (!signal?.aborted && outcomes.every((outcome) => outcome === 'not-found')) {
    let finalProgress: FetchProgress = { deployments: [], mode: 'per-module' };
    const deployments = await fetchModulesGlobally(config, {
      modules: await loadModules(),
      regions,
      onProgress: (progress) => {
        finalProgress = progress;
        onProgress?.(progress);
      },
      signal,
    });
    return { ...finalProgress, deployments };
  }

  // A 404 in only some regions counts as a failed region.
  const reason = outcomes
    .map((outcome) => (outcome === 'not-found' ? 'request-failed' : outcome))
    .find(Boolean);
  return report(reason);
};

/**
 * A failed request contributes nothing rather than failing the whole load; `onProgress`
 * says the list is short instead. Narrowed to a module, rows are summaries without
 * variables, outputs or policy results.
 */
export const fetchDeployments = async (
  config: FetchConfig,
  {
    projectIds,
    regions,
    module,
    onProgress,
    signal,
  }: {
    projectIds: string[];
    regions: string[];
    /** Registry name of a module or stack. Omit for all deployments. */
    module?: string;
    /** Called as pages arrive and once at the end, with `incomplete` set if the list is short. */
    onProgress?: (progress: FetchProgress) => void;
    /** Stops further requests; the partial result is then of no use to the caller. */
    signal?: AbortSignal;
  },
): Promise<Deployment[]> => {
  if (projectIds.length === 0 || regions.length === 0) return [];

  if (module) {
    // The endpoint returns every project the token allows, so pass the selection to filter.
    return fetchModulesGlobally(config, {
      modules: [module],
      regions,
      projectIds,
      onProgress,
      signal,
    });
  }

  const paths = batchProjectIds(projectIds).flatMap((batch) =>
    regions.map((region) => accountDeploymentsPath(batch, region)),
  );

  // Kept per request so the list comes out in request order, whichever answers first.
  const pages = paths.map((): Deployment[] => []);
  const report = (incomplete?: IncompleteReason) =>
    onProgress?.({ deployments: pages.flat(), incomplete });

  const requests = paths.map((path, index) => ({ path, index }));
  const reasons = await mapWithConcurrency(requests, MAX_CONCURRENT_REQUESTS, ({ path, index }) =>
    fetchAllPages(
      config,
      path,
      (rows) => {
        pages[index].push(...rows);
        report();
      },
      signal,
    ),
  );

  // This route always exists, so a 404 is a failed request.
  report(
    reasons.map((reason) => (reason === 'not-found' ? 'request-failed' : reason)).find(Boolean),
  );
  return pages.flat();
};
