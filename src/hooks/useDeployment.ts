import { useState, useCallback, useEffect, useRef } from 'react';
import { Deployment } from '../types/Deployment';
import { useConfig } from './useConfig';

interface UseDeploymentResult {
  value: Deployment | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

export const useDeployment = (
  project: string | undefined,
  region: string | undefined,
  environment: string | undefined,
  deploymentId: string | undefined,
): UseDeploymentResult => {
  const config = useConfig();
  const [value, setValue] = useState<Deployment | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  const initialLoadDone = useRef(false);

  const fetchDeployment = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      try {
        const encodedEnvironment = encodeURIComponent(environment ?? '');
        const encodedDeploymentId = encodeURIComponent(deploymentId ?? '');

        const response = await config.fetch(
          config.getApiUrl(
            `api/proxy/api/infraweave/api/v1/deployment/${project}/${region}/${encodedEnvironment}/${encodedDeploymentId}`,
          ),
        );

        if (response.status >= 300 && response.status < 400) {
          throw new Error('Redirected to login or guest page');
        }

        const json = await response.json();
        setValue((prev) => {
          // Bail out if the data is identical — preserves reference stability for
          // downstream useCallback/useAsync deps, preventing unnecessary re-renders.
          if (prev && JSON.stringify(prev) === JSON.stringify(json)) return prev;
          return json;
        });
        setError(undefined);
      } catch (err) {
        if (!silent) setError(err as Error);
      } finally {
        if (!silent) setLoading(false);
        initialLoadDone.current = true;
      }
    },
    [config, environment, deploymentId, project, region],
  );

  useEffect(() => {
    fetchDeployment({ silent: initialLoadDone.current });
  }, [fetchDeployment]);

  // Poll every 5s while the deployment is in a transient state (silent — no loading spinner)
  useEffect(() => {
    if (value && (value.status === 'requested' || value.status === 'initiated')) {
      const interval = setInterval(() => fetchDeployment({ silent: true }), 5000);
      return () => clearInterval(interval);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchDeployment, value?.status]);

  // Track the latest epoch in a ref so the background poll can compare without
  // capturing a stale closure value
  const lastEpochRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    lastEpochRef.current = value?.epoch;
  }, [value?.epoch]);

  // Background epoch poll every 30s for stable (non-transient) states.
  // Fetches the deployment and compares epoch; if changed, updates state so
  // dependent components (e.g. RecentEvents with 5 change records) re-fetch.
  useEffect(() => {
    const isTransient = value?.status === 'requested' || value?.status === 'initiated';
    if (!value || isTransient) return undefined;

    const {
      project_id,
      region: deploymentRegion,
      environment: deploymentEnv,
      deployment_id,
    } = value;

    const poll = async () => {
      try {
        const encodedEnvironment = encodeURIComponent(deploymentEnv ?? '');
        const encodedDeploymentId = encodeURIComponent(deployment_id ?? '');
        const response = await config.fetch(
          config.getApiUrl(
            `api/proxy/api/infraweave/api/v1/deployment/${project_id}/${deploymentRegion}/${encodedEnvironment}/${encodedDeploymentId}?fields=epoch`,
          ),
        );
        if (response.status >= 300 && response.status < 400) return;
        const json: Partial<Deployment> = await response.json();
        if (json?.epoch !== undefined && json.epoch !== lastEpochRef.current) {
          await fetchDeployment({ silent: true });
        }
      } catch {
        // Silently ignore background poll errors
      }
    };

    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
    // Re-create interval only when the deployment identity or status changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config,
    value?.status,
    value?.project_id,
    value?.region,
    value?.environment,
    value?.deployment_id,
  ]);

  return { value, loading, error, refetch: () => fetchDeployment() };
};
