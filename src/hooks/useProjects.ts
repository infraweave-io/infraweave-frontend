import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useConfig } from './useConfig';
import { Project } from '../types/Project';
import {
  getSharedProjects,
  getSharedProjectsAge,
  publishProjects,
  subscribeToSharedProjects,
} from '../utils/projectCache';

/**
 * How long a cached list is trusted without asking the API again. Projects are
 * created rarely, so within this window a mount renders the cache and makes no
 * request at all.
 */
export const PROJECTS_FRESH_FOR_MS = 60000;

export interface ProjectsState {
  /** Projects to render. Seeded from the cache, then replaced by the fetch. */
  projects: Project[];
  /**
   * True only when there is nothing to show yet. A background refresh over a
   * warm cache leaves this false, so the caller keeps drawing the cached list
   * instead of flashing a spinner.
   */
  loading: boolean;
  /** True while a request is in flight, cache warm or not. */
  refreshing: boolean;
  /**
   * Set when the last request failed. `projects` still holds the cached list in
   * that case, so a consumer should only surface this when the list is empty.
   */
  error?: Error;
  /** Fetch again now, ignoring cache freshness — e.g. after creating a project. */
  refresh: () => Promise<void>;
}

/**
 * The API has been defensive about its envelope, so accept all three shapes
 * rather than rendering an empty list when it changes.
 */
const toProjectList = (json: unknown): Project[] => {
  const candidate =
    (json as { Items?: unknown })?.Items ?? (json as { items?: unknown })?.items ?? json;
  return Array.isArray(candidate) ? (candidate as Project[]) : [];
};

/**
 * Shared across every mount so the providers and panels that all need the
 * project list issue one request between them rather than one each. Cleared as
 * soon as it settles, so it only ever collapses genuinely concurrent fetches.
 */
let inFlight: Promise<void> | null = null;

/**
 * Loads the project list, showing the previously cached copy immediately and
 * only going to the network when that copy has gone stale.
 *
 * Every consumer of `/api/v1/projects` used to hold its own copy of this fetch
 * and its own spinner, which meant the filter panels blanked out on every visit.
 * The cache is what makes the list appear instantly; the staleness check — run on
 * mount and again whenever the tab is returned to — is what keeps an added or
 * removed project, and any new region, showing up without refetching on every
 * mount. Every instance reads one shared list, so a refresh reaches all of them.
 */
export const useProjects = (): ProjectsState => {
  const config = useConfig();
  // One list for every instance: the panels and providers that all read it stay
  // in step, whichever of them triggered the fetch.
  const { projects } = useSyncExternalStore(subscribeToSharedProjects, getSharedProjects);
  const [loading, setLoading] = useState(() => getSharedProjects().projects.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const request =
        inFlight ??
        (inFlight = (async () => {
          const url = config.getApiUrl('api/proxy/api/infraweave/api/v1/projects');
          const response = await config.fetch(url);

          if (response.status >= 300 && response.status < 400) {
            throw new Error('Redirected to login or guest page');
          }
          if (!response.ok) {
            throw new Error(
              `Failed to fetch projects: HTTP ${response.status} ${response.statusText}`.trim(),
            );
          }

          const list = toProjectList(await response.json());
          // A successful empty response is still authoritative — it means every
          // project was removed — so this replaces the cache rather than keeping it.
          // Published from inside the shared request, so a single fetch updates
          // every instance rather than only the one that asked for it.
          publishProjects(list, Date.now());
        })().finally(() => {
          inFlight = null;
        }));

      await request;
      if (cancelled.current) return;

      setError(undefined);
    } catch (err) {
      if (cancelled.current) return;
      // Deliberately does not clear `projects`: a failed refresh should leave
      // the cached list on screen rather than emptying the filter panel.
      setError(err as Error);
    } finally {
      if (!cancelled.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [config]);

  const refreshIfStale = useCallback(() => {
    if (Date.now() - getSharedProjectsAge() < PROJECTS_FRESH_FOR_MS) {
      // Cache is recent enough to stand on its own; no request.
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  useEffect(() => {
    refreshIfStale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  /**
   * Mounting is not enough on its own: the providers that own this list sit above
   * the router, so on a long-lived tab they mount once and the list would never
   * be looked at again — where the polling interval this replaced would at least
   * have picked up an added or removed project. Coming back to the tab is the
   * moment that matters, and it costs nothing while the tab sits idle.
   */
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'hidden') return;
      refreshIfStale();
    };
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [refreshIfStale]);

  return { projects, loading, refreshing, error, refresh };
};

export default useProjects;
