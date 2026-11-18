import { useEffect, useRef, useState } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import { Deployment, type StackModuleUsage } from '../../../types/Deployment';
import { Module } from '../../../types/Module';
import { mapWithConcurrency } from '../../../utils/deploymentFetch';

const MAX_CONCURRENT_STACK_REQUESTS = 6;

type StackComponent = NonNullable<Module['stack_data']>['modules'][number];

type StackVersionKey = {
  track: string;
  name: string;
  version: string;
};

type CompositionResult = {
  /** Raw API entries; a malformed composition can hold nulls. */
  modules: (StackComponent | null)[];
  complete: boolean;
};

export interface StackModuleUsageState {
  uses: StackModuleUsage[];
  loading: boolean;
  incomplete: boolean;
}

const keyFor = ({ track, name, version }: StackVersionKey): string =>
  JSON.stringify([track, name, version]);

/**
 * Complete compositions by config, then stack version. A published stack version's
 * composition does not change, so remounts and source toggles reuse it; failures are retried.
 */
const compositionCache = new WeakMap<object, Map<string, CompositionResult>>();

const cachedCompositions = (config: object): Map<string, CompositionResult> => {
  let cache = compositionCache.get(config);
  if (!cache) {
    cache = new Map();
    compositionCache.set(config, cache);
  }
  return cache;
};

const stackKeyFor = (deployment: Deployment): StackVersionKey | null => {
  const { module_track: track, module: name, module_version: version } = deployment;
  if (!track || !name || !version) {
    return null;
  }
  return { track, name, version };
};

const fetchStackComposition = async (
  config: ReturnType<typeof useConfig>,
  stack: StackVersionKey,
  signal: AbortSignal,
): Promise<CompositionResult> => {
  if (signal.aborted) {
    return { modules: [], complete: false };
  }

  const trackPath = encodeURIComponent(stack.track);
  const namePath = encodeURIComponent(stack.name);
  const versionPath = encodeURIComponent(stack.version);
  const path = `api/proxy/api/infraweave/api/v1/stack/${trackPath}/${namePath}/${versionPath}`;
  const response = await config.fetch(config.getApiUrl(path), { signal });
  if (!response.ok) {
    return { modules: [], complete: false };
  }

  const record = (await response.json()) as Module | null;
  const modules = record?.stack_data?.modules;
  if (!Array.isArray(modules)) {
    return { modules: [], complete: false };
  }
  return { modules: modules as (StackComponent | null)[], complete: true };
};

/** Expands deployed stacks into their version-pinned component module occurrences. */
export const useStackModuleUsage = (stackDeployments: Deployment[]): StackModuleUsageState => {
  const config = useConfig();
  const deploymentsRef = useRef(stackDeployments);
  if (
    deploymentsRef.current.length !== stackDeployments.length ||
    deploymentsRef.current.some((deployment, index) => deployment !== stackDeployments[index])
  ) {
    deploymentsRef.current = stackDeployments;
  }
  const deploymentRows = deploymentsRef.current;
  const [state, setState] = useState<{
    deployments: Deployment[];
    config: ReturnType<typeof useConfig>;
    result: StackModuleUsageState;
  }>(() => ({
    deployments: deploymentRows,
    config,
    result: {
      uses: [],
      loading: deploymentRows.length > 0,
      incomplete: false,
    },
  }));

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setState({
      deployments: deploymentRows,
      config,
      result: {
        uses: [],
        loading: deploymentRows.length > 0,
        incomplete: false,
      },
    });
    const load = async () => {
      const stacksByKey = new Map<string, StackVersionKey>();
      let incomplete = false;
      for (const deployment of deploymentRows) {
        const stack = stackKeyFor(deployment);
        if (!stack) {
          incomplete = true;
          continue;
        }
        stacksByKey.set(keyFor(stack), stack);
      }

      const cache = cachedCompositions(config);
      const entries = Array.from(stacksByKey.entries());
      const compositions = await mapWithConcurrency(
        entries,
        MAX_CONCURRENT_STACK_REQUESTS,
        async ([key, stack]): Promise<[string, CompositionResult]> => {
          const cached = cache.get(key);
          if (cached) {
            return [key, cached];
          }
          try {
            const composition = await fetchStackComposition(config, stack, controller.signal);
            if (composition.complete) cache.set(key, composition);
            return [key, composition];
          } catch {
            return [key, { modules: [], complete: false }];
          }
        },
      );
      if (cancelled) {
        return;
      }

      const compositionByKey = new Map(compositions);
      const uses: StackModuleUsage[] = [];
      for (const deployment of deploymentRows) {
        const stack = stackKeyFor(deployment);
        if (!stack) continue;

        const composition = compositionByKey.get(keyFor(stack));
        if (!composition?.complete) {
          incomplete = true;
          continue;
        }

        composition.modules.forEach((component, componentIndex) => {
          if (!component?.module || !component.version) {
            incomplete = true;
            return;
          }
          uses.push({
            ...deployment,
            module: component.module,
            module_type: 'module',
            module_version: component.version,
            module_track: component.track || '',
            usageSource: 'stack',
            stackName: deployment.module,
            stackVersion: deployment.module_version,
            componentIndex,
          });
        });
      }

      setState({
        deployments: deploymentRows,
        config,
        result: {
          uses,
          loading: false,
          incomplete,
        },
      });
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [config, deploymentRows]);

  if (state.deployments !== deploymentRows || state.config !== config) {
    return {
      uses: [],
      loading: deploymentRows.length > 0,
      incomplete: false,
    };
  }
  return state.result;
};
