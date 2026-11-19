import { useEffect, useMemo, useState } from 'react';
import { AccountCosts } from '../types/Cost';
import { Deployment } from '../types/Deployment';
import { costQueryString } from '../utils/cost';
import { useConfig } from './useConfig';

export const deploymentCostKey = (projectId: string, deploymentId: string) =>
  `${projectId}|${deploymentId}`;

interface UseDeploymentCostsResult {
  /** Cost per `deploymentCostKey`; a deployment from a loaded account but missing here cost nothing. */
  costs: Map<string, number>;
  unit: string;
  /** Accounts whose costs have arrived. */
  loadedProjects: Set<string>;
  /** Accounts whose costs could not be read, with why. */
  failedProjects: Map<string, string>;
}

/** The list's window: long enough to smooth out a day's noise, short enough to be current. */
export const COST_LIST_DAYS = 30;

/**
 * The cost of the listed deployments over the last {@link COST_LIST_DAYS} days, read with one
 * request per account rather than one per deployment. Only re-read when the accounts change,
 * not on every refresh of the list.
 */
export const useDeploymentCosts = (
  deployments: Deployment[],
  enabled: boolean,
): UseDeploymentCostsResult => {
  const config = useConfig();
  const [costs, setCosts] = useState<Map<string, number>>(new Map());
  const [unit, setUnit] = useState('USD');
  const [loadedProjects, setLoadedProjects] = useState<Set<string>>(new Set());
  const [failedProjects, setFailedProjects] = useState<Map<string, string>>(new Map());

  // Any one region of an account will do: its costs are read account-wide.
  const accounts = useMemo(() => {
    const regionByProject = new Map<string, string>();
    for (const d of deployments) {
      if (d.project_id && !regionByProject.has(d.project_id)) {
        regionByProject.set(d.project_id, d.region);
      }
    }
    return [...regionByProject].sort(([a], [b]) => a.localeCompare(b));
  }, [deployments]);
  const accountsKey = accounts.map(([project]) => project).join(',');

  useEffect(() => {
    if (!enabled || accounts.length === 0) return undefined;
    let cancelled = false;

    setCosts(new Map());
    setLoadedProjects(new Set());
    setFailedProjects(new Map());
    // Totals only: the list never draws the periods, and fewer of them are fewer billed pages.
    const query = costQueryString({ periods: COST_LIST_DAYS, series: 'false' });

    for (const [project, region] of accounts) {
      (async () => {
        try {
          const response = await config.fetch(
            config.getApiUrl(`api/proxy/api/infraweave/api/v1/costs/${project}/${region}?${query}`),
          );
          const json = await response.json().catch(() => undefined);
          if (!response.ok) throw new Error(json?.error ?? `Request failed: ${response.status}`);
          if (cancelled) return;

          const result = json as AccountCosts;
          setUnit(result.unit);
          setCosts((prev) => {
            const next = new Map(prev);
            for (const { deployment_id, amount } of result.deployments) {
              next.set(deploymentCostKey(project, deployment_id), amount);
            }
            return next;
          });
          setLoadedProjects((prev) => new Set(prev).add(project));
        } catch (err) {
          if (cancelled) return;
          setFailedProjects((prev) => new Map(prev).set(project, (err as Error).message));
        }
      })();
    }

    return () => {
      cancelled = true;
    };
    // Keyed on the accounts, not the deployment objects, which every list refresh replaces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, enabled, accountsKey]);

  // One object per change of its parts, so callers can memoize on it.
  return useMemo(
    () => ({ costs, unit, loadedProjects, failedProjects }),
    [costs, unit, loadedProjects, failedProjects],
  );
};
