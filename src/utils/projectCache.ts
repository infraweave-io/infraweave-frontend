/**
 * Remembers the project list, so the filter panels and the Projects table can be
 * drawn immediately on a revisit instead of showing a spinner while
 * `/api/v1/projects` round-trips.
 *
 * Unlike the module registry, a project is small and entirely display-oriented
 * here — name, description and regions — so the whole record is cached. The
 * stored timestamp is what lets a mount skip the request altogether when the
 * cached copy is still fresh; once it goes stale the next refresh quietly
 * replaces it, which is what picks up an added or removed project (and any new
 * region, since regions are read off the project records).
 *
 * There are two layers here: the stored copy, which survives a reload, and the
 * in-memory copy below it, which every `useProjects` instance shares within a
 * page load.
 */

import { Project } from '../types/Project';

const CACHE_KEY = 'infraweave.projects.v1';
/** Key used before the cache was shared; removed so it doesn't linger. */
const LEGACY_CACHE_KEY = 'cachedProjects';

interface CacheEnvelope {
  fetchedAt: number;
  projects: Project[];
}

interface CachedProjects {
  projects: Project[];
  /**
   * Epoch ms of the fetch that produced this list, or 0 when unknown — which is
   * also what a legacy cache entry reports, so it is treated as stale.
   */
  fetchedAt: number;
}

const EMPTY: CachedProjects = { projects: [], fetchedAt: 0 };

/**
 * A cache entry is whatever the API returned last time, so it is validated at
 * both ends. Every field a consumer indexes into has to be present, or the
 * record takes that consumer down with it: `project_id` keys the filter panel's
 * checkboxes, `name` labels them, and `regions` and `repositories` are both
 * flat-mapped by `DeploySelectedContext` and then read per element — a missing
 * array appends `undefined` there and throws on the next property access.
 * `description` is not checked: it is the one field rendered conditionally.
 */
const isProject = (entry: unknown): entry is Project =>
  typeof (entry as Project)?.project_id === 'string' &&
  typeof (entry as Project)?.name === 'string' &&
  Array.isArray((entry as Project)?.regions) &&
  Array.isArray((entry as Project)?.repositories);

/**
 * Anything dropped by validation means the stored copy no longer matches what
 * the API returned, so its age can't be trusted: reporting it as stale is what
 * makes the next mount refetch instead of standing on a silently short list —
 * or, when nothing survives validation, on an empty one with no spinner, no
 * error and nothing to recover from.
 */
const ageOf = (projects: Project[], stored: unknown[], fetchedAt: unknown): number =>
  projects.length === stored.length && typeof fetchedAt === 'number' ? fetchedAt : 0;

const readCachedProjects = (): CachedProjects => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      const envelope = parsed as CacheEnvelope;
      if (Array.isArray(envelope?.projects)) {
        const projects = envelope.projects.filter(isProject);
        return { projects, fetchedAt: ageOf(projects, envelope.projects, envelope.fetchedAt) };
      }
    }

    // Pre-timestamp cache: usable as a seed, but with no age it counts as stale
    // so the very next mount refreshes it.
    const legacy: unknown = JSON.parse(localStorage.getItem(LEGACY_CACHE_KEY) ?? 'null');
    if (Array.isArray(legacy)) {
      return { projects: legacy.filter(isProject), fetchedAt: 0 };
    }
    return EMPTY;
  } catch {
    // Corrupt JSON, or storage blocked entirely (private mode / disabled
    // cookies). A cache miss is always an acceptable outcome here.
    return EMPTY;
  }
};

/** Takes an already-validated list; see `publishProjects`, its only caller. */
const writeCachedProjects = (projects: Project[], fetchedAt: number): void => {
  try {
    const envelope: CacheEnvelope = { fetchedAt, projects };
    localStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
    localStorage.removeItem(LEGACY_CACHE_KEY);
  } catch {
    // Over quota, or storage blocked. Purely an optimisation — drop it.
  }
};

interface ProjectList {
  projects: Project[];
}

/**
 * The list in memory, shared by every `useProjects` instance. Several providers
 * mount that hook at once — the standalone shell, the root page and both resource
 * tabs — and they share this storage and the in-flight request, but without a
 * copy here they would not share the *result*: an instance that mounted while the
 * stored copy was fresh would keep drawing it even after another instance fetched
 * a newer one.
 *
 * The snapshot's identity is what tells React to re-render, so it is replaced only
 * when the list actually changed; `fetchedAt` is not rendered, so it can advance
 * on an unchanged refresh without waking every consumer.
 */
let shared: ProjectList | null = null;
let sharedFetchedAt = 0;
let sharedJson = '';
const listeners = new Set<() => void>();

/** Stable across renders until the list changes, as `useSyncExternalStore` needs. */
export const getSharedProjects = (): ProjectList => {
  if (!shared) {
    const cached = readCachedProjects();
    shared = { projects: cached.projects };
    sharedFetchedAt = cached.fetchedAt;
    sharedJson = JSON.stringify(cached.projects);
  }
  return shared;
};

/** Epoch ms of the fetch behind the shared list, or 0 when it came from nowhere. */
export const getSharedProjectsAge = (): number => {
  getSharedProjects();
  return sharedFetchedAt;
};

export const subscribeToSharedProjects = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notify = (): void => {
  for (const listener of [...listeners]) listener();
};

/**
 * Records a freshly fetched list: stored for the next page load and handed to
 * every mounted consumer, whichever one asked for it.
 */
export const publishProjects = (projects: Project[], fetchedAt: number): void => {
  // Validated on the way in, not only on the way out of storage: otherwise a
  // malformed record renders this session and then disappears on the next reload,
  // when the read drops it.
  const valid = projects.filter(isProject);
  // Same reasoning as `ageOf`, applied to the write: once records have been
  // dropped, this list no longer matches what the API returned, so its age can't
  // be trusted either. Reporting it as stale is what makes the next staleness
  // check refetch, instead of standing for a full window on a short list — or, if
  // nothing survived validation, on an empty one with no spinner and no error.
  const age = valid.length === projects.length ? fetchedAt : 0;
  writeCachedProjects(valid, age);
  sharedFetchedAt = age;
  const json = JSON.stringify(valid);
  if (json === sharedJson) return;
  sharedJson = json;
  shared = { projects: valid };
  notify();
};

/**
 * Called when switching between mock and real backends: the two have disjoint
 * project sets, so mock projects must not be drawn against a real API. Drops the
 * in-memory copy too, which would otherwise outlive the storage it came from.
 */
export const clearProjectCache = (): void => {
  shared = null;
  sharedFetchedAt = 0;
  sharedJson = '';
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(LEGACY_CACHE_KEY);
  } catch {
    // Nothing to do — see above.
  }
  notify();
};
