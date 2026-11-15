/**
 * Fleet deployment summaries shared by every Adoption & Health view. The stored copy is
 * keyed by user and scope so it is never drawn for another user or another set of accounts.
 */

import { Deployment } from '../types/Deployment';
import { fetchFleetDeployments, FetchProgress, IncompleteReason } from './deploymentFetch';
import { decodeJwtPayload } from './oauth';

const CACHE_KEY = 'infraweave.fleet.v2';
/** Stored before the fleet recorded its owner; removed so it is never read. */
const LEGACY_CACHE_KEYS = ['infraweave.fleet.v1'];

/** Stands in for a real token when auth is disabled; see StandaloneApp. */
const AUTH_DISABLED_TOKEN = 'disabled_auth_dummy_token';

/** Past this, views still draw the stored fleet but refresh it in the background. */
export const FLEET_FRESH_FOR_MS = 15 * 60 * 1000;

/**
 * Short so a transient failure is retried on the next visit, but not on every view switch,
 * which in the per-module fallback means hundreds of requests while a region is down.
 */
export const INCOMPLETE_FLEET_FRESH_FOR_MS = 60 * 1000;

export type FleetSnapshot = {
  /** The last load that got any answer, or the stored one. */
  deployments: Deployment[];
  /** Epoch ms of the load behind `deployments`, or 0 when there is none. */
  fetchedAt: number;
  /** The accounts and regions `deployments` was loaded for. */
  scope?: string;
  /** Set when that load stopped short. */
  incomplete?: IncompleteReason;
  /** The previous `deployments` stay until the load finishes. */
  loading: boolean;
  progress?: FetchProgress;
  /**
   * Set when the last load threw or got no answer at all, as opposed to coming back short.
   * `deployments` are then still from the load before it.
   */
  failed?: { scope: string; at: number };
};

type FetchConfig = Parameters<typeof fetchFleetDeployments>[0];

type StoredFleet = {
  owner: string;
  scope: string;
  fetchedAt: number;
  incomplete?: IncompleteReason;
  deployments: Deployment[];
};

const EMPTY: FleetSnapshot = { deployments: [], fetchedAt: 0, loading: false };

/**
 * `iss|sub`, since a subject is only unique within its issuer. Null (memory only) when either
 * is missing; a username or email is not unique across providers, so it is no fallback.
 */
const currentOwner = (): string | null => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    if (token === AUTH_DISABLED_TOKEN) return 'auth-disabled';
    const { iss, sub } = decodeJwtPayload(token);
    if (typeof iss !== 'string' || !iss || typeof sub !== 'string' || !sub) return null;
    return `${iss}|${sub}`;
  } catch {
    return null;
  }
};

const readStored = (): FleetSnapshot => {
  try {
    const owner = currentOwner();
    if (!owner) return EMPTY;
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as StoredFleet | null;
    if (
      parsed &&
      parsed.owner === owner &&
      Array.isArray(parsed.deployments) &&
      typeof parsed.fetchedAt === 'number' &&
      typeof parsed.scope === 'string'
    ) {
      return {
        deployments: parsed.deployments,
        fetchedAt: parsed.fetchedAt,
        scope: parsed.scope,
        incomplete: parsed.incomplete,
        loading: false,
      };
    }
  } catch {
    // Corrupt JSON or storage blocked: a cache miss is always acceptable here.
  }
  return EMPTY;
};

const removeStored = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
    for (const key of LEGACY_CACHE_KEYS) localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
};

const writeStored = (fleet: Omit<StoredFleet, 'owner'>): void => {
  const owner = currentOwner();
  if (!owner) {
    removeStored();
    return;
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...fleet, owner }));
    for (const key of LEGACY_CACHE_KEYS) localStorage.removeItem(key);
  } catch {
    // Over quota or storage blocked: keep it in memory for this page load only.
    removeStored();
  }
};

type InFlightLoad = { scope: string; promise: Promise<void>; controller: AbortController };

let snapshot: FleetSnapshot | null = null;
let inFlight: InFlightLoad | null = null;
/** Bumped on clear and when a load replaces another, so an overtaken load cannot write. */
let generation = 0;
const listeners = new Set<() => void>();

const set = (next: FleetSnapshot) => {
  snapshot = next;
  for (const listener of Array.from(listeners)) listener();
};

/** Stable until the fleet changes, as `useSyncExternalStore` needs. */
export const getFleetSnapshot = (): FleetSnapshot => {
  if (!snapshot) snapshot = readStored();
  return snapshot;
};

export const subscribeToFleet = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Timer-driven checks pass `retryIncomplete = false` so a region that stays down does not
 * reload the fleet every minute; the short retry is for a reader arriving or coming back.
 * A failed load is retried on the same schedule as a short one.
 */
export const needsFleetLoad = (
  scope: string,
  now = Date.now(),
  retryIncomplete = true,
): boolean => {
  const current = getFleetSnapshot();
  const retryAfter = retryIncomplete ? INCOMPLETE_FLEET_FRESH_FOR_MS : FLEET_FRESH_FOR_MS;
  if (current.failed?.scope === scope && now - current.failed.at < retryAfter) return false;
  const freshFor = current.incomplete ? retryAfter : FLEET_FRESH_FOR_MS;
  return current.scope !== scope || now - current.fetchedAt >= freshFor;
};

/**
 * Joins a running load for the same scope and supersedes one for another. `deployments`
 * only changes at the end, so a refresh never shows half the old fleet and half the new.
 */
export const loadFleet = (
  config: FetchConfig,
  options: { scope: string; regions: string[]; loadModules: () => Promise<string[]> },
): Promise<void> => {
  if (inFlight?.scope === options.scope) return inFlight.promise;
  if (inFlight) {
    generation += 1;
    inFlight.controller.abort();
  }

  const started = generation;
  const controller = new AbortController();
  const { scope, ...fetchOptions } = options;
  set({ ...getFleetSnapshot(), loading: true, progress: undefined, failed: undefined });

  const promise: Promise<void> = fetchFleetDeployments(config, {
    ...fetchOptions,
    signal: controller.signal,
    onProgress: (progress) => {
      if (generation === started) set({ ...getFleetSnapshot(), progress });
    },
  })
    .then((result) => {
      if (generation !== started) return;
      // Not one page answered, e.g. still offline after a laptop wakes: keep the fleet there
      // is rather than store an empty one as fresh. Any page that did answer is kept, as a
      // short fleet, even when a later page of the same region failed.
      if (result.incomplete && !result.sources?.some((source) => source.requests > 0)) {
        set({
          ...getFleetSnapshot(),
          loading: false,
          progress: result,
          failed: { scope, at: Date.now() },
        });
        return;
      }
      const fetchedAt = Date.now();
      writeStored({
        scope,
        fetchedAt,
        incomplete: result.incomplete,
        deployments: result.deployments,
      });
      set({
        deployments: result.deployments,
        fetchedAt,
        scope,
        incomplete: result.incomplete,
        loading: false,
        progress: result,
      });
    })
    .catch((err) => {
      console.error('Failed to load the fleet', err);
      if (generation === started) {
        set({ ...getFleetSnapshot(), loading: false, failed: { scope, at: Date.now() } });
      }
    })
    .finally(() => {
      // A clear or a newer load may have replaced this one.
      if (inFlight?.promise === promise) inFlight = null;
    });

  inFlight = { scope, promise, controller };
  return promise;
};

/** Called on every session teardown so one user's fleet is never drawn for the next. */
export const clearFleetCache = (): void => {
  generation += 1;
  inFlight?.controller.abort();
  inFlight = null;
  removeStored();
  set(EMPTY);
};
