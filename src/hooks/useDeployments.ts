import { useState, useEffect, useRef } from 'react';
import { Deployment, Project } from '../types/Deployment';
import { fetchDeployments, IncompleteReason } from '../utils/deploymentFetch';
import {
  deploymentListScope,
  readCachedDeployments,
  writeCachedDeployments,
} from '../utils/deploymentListCache';
import { useConfig } from './useConfig';

interface UseDeploymentsResult {
  deployments: Deployment[];
  /** True only while there is nothing to draw yet. */
  loading: boolean;
  /** True while a load runs behind rows already on screen, which may be about to change. */
  refreshing: boolean;
  error: Error | null;
  /** Set when the last load stopped short, so `deployments` may be missing some. */
  incomplete?: IncompleteReason;
  refetch: () => void;
  isModalOpenRef: React.MutableRefObject<boolean>;
}

export const useDeployments = (
  projects: Project[],
  selectedProjectNames: string[],
  selectedRegions: string[],
  module?: string,
): UseDeploymentsResult => {
  const config = useConfig();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [incomplete, setIncomplete] = useState<IncompleteReason | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isModalOpenRef = useRef(false);
  // Refs, not state: the interval keeps the closure it was created with.
  const hasLoadedRef = useRef(false);
  const inFlightRef = useRef<AbortController | null>(null);

  const selectedProjectIds = projects
    .filter((project) => selectedProjectNames.includes(project.name))
    .map((project) => project.project_id);
  const scope = deploymentListScope(selectedProjectIds, selectedRegions, module);

  const loadDeployments = async () => {
    if (isModalOpenRef.current) return;

    // A newer load supersedes the one running, so an older result can never land last.
    inFlightRef.current?.abort();
    const controller = new AbortController();
    inFlightRef.current = controller;

    try {
      // Only the first load shows the spinner; later ones refresh the rows in place.
      if (!hasLoadedRef.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      let reason: IncompleteReason | undefined;
      const results = await fetchDeployments(config, {
        projectIds: selectedProjectIds,
        regions: selectedRegions,
        module,
        signal: controller.signal,
        onProgress: (progress) => {
          reason = progress.incomplete;
        },
      });
      if (controller.signal.aborted) return;

      const sorted = [...results].sort((a, b) => (b.epoch || 0) - (a.epoch || 0));
      setDeployments(sorted);
      setIncomplete(reason);
      hasLoadedRef.current = true;
      // Nothing answered, e.g. still offline after a laptop wakes: keep the list there is for
      // the next visit rather than store an empty one.
      if (sorted.length > 0 || !reason) {
        writeCachedDeployments(scope, {
          deployments: sorted,
          incomplete: reason,
          fetchedAt: Date.now(),
        });
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err as Error);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (projects.length > 0) {
      // Draw the last list for this selection at once; the load below then refreshes it.
      const cached = readCachedDeployments(scope);
      if (cached) {
        setDeployments(cached.deployments);
        setIncomplete(cached.incomplete);
        setLoading(false);
        hasLoadedRef.current = true;
      }
      loadDeployments();
      const intervalId = setInterval(loadDeployments, 60000);
      return () => {
        clearInterval(intervalId);
        inFlightRef.current?.abort();
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, selectedProjectNames, selectedRegions, module]);

  return {
    deployments,
    loading,
    refreshing,
    error,
    incomplete,
    refetch: loadDeployments,
    isModalOpenRef,
  };
};
