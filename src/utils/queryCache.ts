/**
 * Results of read-only requests, kept in memory for a few minutes so a view that mounts again
 * (the Overview's widgets after a tab switch) draws at once instead of loading again. Not kept
 * in localStorage: a reload is a fair point to fetch afresh.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/** How long a result is used before the next mount loads it again. */
export const QUERY_FRESH_FOR_MS = 5 * 60 * 1000;

type Entry = {
  data?: unknown;
  /** Set when the last load failed. `data` is then from the load before it, if any. */
  error?: Error;
  /** Epoch ms of the last successful load, or 0 when there is none. */
  fetchedAt: number;
};

const entries = new Map<string, Entry>();
/** The load running for each key, which settles once its result or error is stored. */
const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
/** Bumped on clear, so a load started for the last session cannot write. */
let generation = 0;

const set = (key: string, entry: Entry) => {
  entries.set(key, entry);
  for (const listener of Array.from(listeners)) listener();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const isFresh = (entry: Entry | undefined, now = Date.now()): boolean =>
  !!entry && !entry.error && entry.fetchedAt > 0 && now - entry.fetchedAt < QUERY_FRESH_FOR_MS;

/** Joins a load already running for `key`, so views mounting together make one request. */
const load = (key: string, fetcher: () => Promise<unknown>): Promise<void> => {
  const running = inFlight.get(key);
  if (running) return running;
  const started = generation;
  const promise = fetcher()
    .then((data) => {
      if (generation === started) set(key, { data, fetchedAt: Date.now() });
    })
    .catch((error: Error) => {
      if (generation !== started) return;
      // Keep the last good result to draw beside the error.
      const previous = entries.get(key);
      set(key, {
        data: previous?.data,
        fetchedAt: previous?.fetchedAt ?? 0,
        error,
      });
    })
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
};

export type CachedQuery<T> = {
  /** The last loaded result. Stays in place while a reload runs. */
  data?: T;
  error?: Error;
  /** True until the first result or error arrives. */
  loading: boolean;
  /** Epoch ms of the load behind `data`, or 0 before the first one finishes. */
  fetchedAt: number;
  /** Loads again now, however fresh the result is. Settles once the result or error is in. */
  reload: () => Promise<void>;
};

/**
 * Loads `fetcher` once per `key` every few minutes, shared by every caller of the same key.
 * `key` must name everything the request depends on; `fetcher` is only read when a load starts.
 */
export const useCachedQuery = <T>(key: string, fetcher: () => Promise<T>): CachedQuery<T> => {
  const entry = useSyncExternalStore(subscribe, () => entries.get(key));
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!isFresh(entries.get(key))) load(key, () => fetcherRef.current());
  }, [key]);

  const reload = useCallback(() => load(key, () => fetcherRef.current()), [key]);

  return {
    data: entry?.data as T | undefined,
    error: entry?.error,
    loading: entry?.data === undefined && !entry?.error,
    fetchedAt: entry?.fetchedAt ?? 0,
    reload,
  };
};

/** Called on session teardown so one user's results are never drawn for the next. */
export const clearQueryCache = (): void => {
  generation += 1;
  entries.clear();
  inFlight.clear();
  for (const listener of Array.from(listeners)) listener();
};
