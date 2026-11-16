import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import { useProjects } from '../../../hooks/useProjects';
import { Deployment } from '../../../types/Deployment';
import { Module } from '../../../types/Module';
import { FetchProgress, IncompleteReason } from '../../../utils/deploymentFetch';
import {
  getFleetSnapshot,
  needsFleetLoad,
  loadFleet,
  subscribeToFleet,
} from '../../../utils/fleetCache';

/**
 * Data for the Adoption & Health views. Deployments come from the shared `fleetCache`,
 * so every view sees the same list and a revisit draws the stored fleet at once.
 */
export type FleetDeployments = {
  /** The module registry alone, one entry per name. */
  moduleCatalogue: Module[];
  /** The stack registry alone, one entry per name. */
  stackCatalogue: Module[];
  /** Account display names by project id. */
  projectNames: Record<string, string>;
  /** Every region any visible account deploys to. */
  regions: string[];
  /** The last loaded fleet. Stays in place while a refresh runs. */
  deployments: Deployment[];
  /** Epoch ms of the load behind `deployments`, or 0 before the first one finishes. */
  fetchedAt: number;
  /** True until the accounts and the catalogue are known. */
  loadingCatalog: boolean;
  /**
   * The module or stack list stopped short or failed, so rankings may miss entries with no
   * deployments. Views that do not rank the registry still work, so it is not an `error`.
   */
  catalogueIncomplete: boolean;
  /** True once the caller's accounts are known. `deployments` is empty until then. */
  accessKnown: boolean;
  /** True when the accounts are known and none of them has a region: no fleet to load. */
  nothingToLoad: boolean;
  /** True while a load of the fleet is running, first or refresh. */
  loadingDeployments: boolean;
  progress?: FetchProgress;
  /**
   * Set when the last load threw or got no answer. `deployments` is then whatever loaded
   * before it.
   */
  loadFailed: boolean;
  /** Set when the load behind `deployments` stopped short of the full fleet. */
  incomplete?: IncompleteReason;
  /** Set when the accounts could not be loaded at all. */
  error: Error | null;
  /** Loads the fleet again now, whatever its age. */
  refresh: () => void;
};

const CATALOGUE_FIELDS = 'fields=module,module_name,track,version';

/** How often an open view checks whether its fleet has gone stale. */
const RECHECK_EVERY_MS = 60 * 1000;

/** Safety net on registry paging, as in `usePaginatedItems`. */
const MAX_CATALOGUE_PAGES = 100;

const withNextToken = (url: string, nextToken: string): string =>
  `${url}${url.includes('?') ? '&' : '?'}next_token=${encodeURIComponent(nextToken)}`;

/** Registry name of a module or stack, whichever field the entry carries it in. */
export const moduleName = (module: Module): string => module.module || module.module_name || '';

/** Records without `module_type` fall back to matching against the stack registry. */
export const isStackDeployment = (d: Deployment, stackNames: Set<string>): boolean =>
  d.module_type ? d.module_type === 'stack' : stackNames.has(d.module);

type CatalogueConfig = ReturnType<typeof useConfig>;

type Catalogue = {
  modules: Module[];
  stacks: Module[];
  /** False when a list stopped short, so modules or stacks may be missing from it. */
  complete: boolean;
};

type CataloguePages = { items: Module[]; complete: boolean };

/** Follows `x-next-token` to the end: the registry is read in 1MB pages and records are large. */
const fetchAllRegistryPages = async (
  config: CatalogueConfig,
  path: string,
): Promise<CataloguePages> => {
  const items: Module[] = [];
  const seenTokens = new Set<string>();
  let nextToken: string | null = null;

  for (let page = 0; page < MAX_CATALOGUE_PAGES; page++) {
    const base = config.getApiUrl(path);
    const response = await config.fetch(nextToken ? withNextToken(base, nextToken) : base);
    if (!response.ok) throw new Error(`Failed to fetch ${path}: HTTP ${response.status}`);
    const json = await response.json();
    const pageItems = json?.Items ?? json?.items ?? json;
    if (!Array.isArray(pageItems)) throw new Error(`Failed to fetch ${path}: expected a list`);
    items.push(...(pageItems as Module[]));

    const token = response.headers.get('x-next-token');
    if (!token) return { items, complete: true };
    if (seenTokens.has(token)) return { items, complete: false };
    seenTokens.add(token);
    nextToken = token;
  }
  return { items, complete: false };
};

const uniqueByName = (items: Module[]): Module[] => {
  const unique = new Map<string, Module>();
  for (const item of items) {
    const name = moduleName(item);
    if (name && !unique.has(name)) unique.set(name, item);
  }
  return Array.from(unique.values());
};

/** A failed module list fails the catalogue; a failed stack list only marks it incomplete. */
export const fetchCatalogue = async (config: CatalogueConfig): Promise<Catalogue> => {
  const [modules, stacks] = await Promise.all([
    fetchAllRegistryPages(config, `api/proxy/api/infraweave/api/v1/modules?${CATALOGUE_FIELDS}`),
    fetchAllRegistryPages(
      config,
      `api/proxy/api/infraweave/api/v1/stacks?${CATALOGUE_FIELDS}`,
    ).catch((): CataloguePages => ({ items: [], complete: false })),
  ]);
  return {
    modules: uniqueByName(modules.items),
    stacks: uniqueByName(stacks.items),
    complete: modules.complete && stacks.complete,
  };
};

export const useFleetDeployments = (): FleetDeployments => {
  const config = useConfig();
  const { projects, loading: loadingProjects, error: projectsError } = useProjects();
  const fleet = useSyncExternalStore(subscribeToFleet, getFleetSnapshot);

  const [catalogue, setCatalogue] = useState<Catalogue>({
    modules: [],
    stacks: [],
    complete: true,
  });
  const [loadingModules, setLoadingModules] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingModules(true);
    fetchCatalogue(config)
      .then((items) => {
        if (!cancelled) setCatalogue(items);
      })
      .catch((err) => {
        console.error('Failed to load the module and stack list', err);
        if (!cancelled) setCatalogue({ modules: [], stacks: [], complete: false });
      })
      .finally(() => {
        if (!cancelled) setLoadingModules(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config]);

  // By value, so `regions` and `load` keep their identity when the project list is
  // republished unchanged.
  const regionsKey = useMemo(
    () =>
      Array.from(new Set(projects.flatMap((p) => p.regions || [])))
        .sort()
        .join(','),
    [projects],
  );
  const regions = useMemo(() => (regionsKey ? regionsKey.split(',') : []), [regionsKey]);
  const projectNames = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.project_id, p.name || p.project_id])),
    [projects],
  );

  // Keyed by value: the project list is republished on every background refresh, and only
  // a change in visible accounts or regions should start a load.
  const projectIdsKey = useMemo(
    () =>
      projects
        .map((p) => p.project_id)
        .sort()
        .join(','),
    [projects],
  );
  const scope = `${projectIdsKey}|${regionsKey}`;

  const load = useCallback(() => {
    if (regions.length === 0) return;
    loadFleet(config, {
      scope,
      regions,
      // Only used when the backend lacks the fleet route. A short catalogue would silently
      // drop deployments there, so fail the load instead.
      loadModules: () =>
        fetchCatalogue(config).then(({ modules, stacks, complete }) => {
          if (!complete) throw new Error('The module and stack list could not be read in full');
          return uniqueByName([...modules, ...stacks]).map(moduleName);
        }),
    });
  }, [config, regions, scope]);

  // `load` only changes with the scope or the config, so a project list republished
  // unchanged does not rerun this.
  const accessKnown = !loadingProjects;
  useEffect(() => {
    if (accessKnown && regions.length > 0 && needsFleetLoad(scope)) load();
  }, [accessKnown, regions.length, scope, load]);

  // Reload a stale fleet on tab focus and on a timer. The tick also keeps "updated N min
  // ago" current.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!accessKnown || regions.length === 0) return undefined;
    const onWake = () => {
      if (document.visibilityState === 'hidden') return;
      if (needsFleetLoad(scope)) load();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      setTick((tick) => tick + 1);
      if (needsFleetLoad(scope, Date.now(), false)) load();
    }, RECHECK_EVERY_MS);
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [accessKnown, regions.length, scope, load]);

  // The stored fleet may predate a change of grants, so filter it to accounts visible now.
  const deployments = useMemo(() => {
    if (!accessKnown) return [];
    const visible = new Set(projects.map((p) => p.project_id));
    return fleet.deployments.filter((d) => visible.has(d.project_id));
  }, [fleet.deployments, projects, accessKnown]);

  return {
    moduleCatalogue: catalogue.modules,
    stackCatalogue: catalogue.stacks,
    projectNames,
    regions,
    deployments,
    fetchedAt: fleet.fetchedAt,
    loadingCatalog: loadingModules || loadingProjects,
    catalogueIncomplete: !catalogue.complete,
    accessKnown,
    nothingToLoad: accessKnown && regions.length === 0,
    loadingDeployments: fleet.loading,
    progress: fleet.progress,
    loadFailed: Boolean(fleet.failed),
    incomplete: fleet.incomplete,
    // A failed project refresh over a cached list is not worth blanking the page for.
    error: projects.length === 0 ? projectsError ?? null : null,
    refresh: load,
  };
};
