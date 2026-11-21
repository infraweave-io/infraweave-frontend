/**
 * The last deployment list loaded for each selection of accounts, regions and module, so the
 * deployments table draws at once on a revisit and refreshes in place. Kept in memory for the
 * page load and in localStorage across reloads, both with their owner: a sign-in in another tab
 * changes the user here too, without clearing this tab's memory.
 */

import { Deployment } from '../types/Deployment';
import { IncompleteReason } from './deploymentFetch';
import { currentOwner } from './ownedStorage';

const CACHE_KEY = 'infraweave.deployments.v1';

/** Selections kept in storage, most recent first; the deployments page and a few module tabs. */
const MAX_STORED_SCOPES = 5;

export type CachedDeploymentList = {
  deployments: Deployment[];
  incomplete?: IncompleteReason;
  /** Epoch ms of the load behind `deployments`. */
  fetchedAt: number;
};

type StoredEntry = CachedDeploymentList & { scope: string };

type StoredLists = { owner: string; entries: StoredEntry[] };

/** Names everything the list request depends on, whatever order the filters were picked in. */
export const deploymentListScope = (
  projectIds: string[],
  regions: string[],
  module?: string,
): string => JSON.stringify([[...projectIds].sort(), [...regions].sort(), module ?? null]);

/**
 * The table never reads inputs, outputs or policy results, which are also the bulk of a row,
 * so they are left out of storage. The copy in memory keeps them.
 */
const forStorage = (row: Deployment): Deployment => ({
  ...row,
  variables: {},
  output: {},
  policy_results: [],
});

/** Keyed by owner and scope. */
const memory = new Map<string, CachedDeploymentList>();

const memoryKey = (owner: string, scope: string): string => JSON.stringify([owner, scope]);

const readStored = (owner: string): StoredEntry[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as StoredLists | null;
    if (!parsed || parsed.owner !== owner || !Array.isArray(parsed.entries)) return [];
    return parsed.entries.filter(
      (entry) =>
        typeof entry?.scope === 'string' &&
        typeof entry.fetchedAt === 'number' &&
        Array.isArray(entry.deployments),
    );
  } catch {
    // Corrupt JSON or storage blocked: a cache miss is always acceptable here.
    return [];
  }
};

const removeStored = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing to do.
  }
};

/** Drops the oldest selections until the rest fit, then gives up on storage altogether. */
const writeStored = (owner: string, entries: StoredEntry[]): void => {
  for (let count = entries.length; count > 0; count--) {
    try {
      const value: StoredLists = { owner, entries: entries.slice(0, count) };
      localStorage.setItem(CACHE_KEY, JSON.stringify(value));
      return;
    } catch {
      // Over quota: try again with fewer.
    }
  }
  removeStored();
};

/**
 * The current user's list for `scope` from this page load, or failing that, an earlier one.
 * Without a known user there is no telling whose a list is, so nothing is read.
 */
export const readCachedDeployments = (scope: string): CachedDeploymentList | undefined => {
  const owner = currentOwner();
  if (!owner) return undefined;
  const key = memoryKey(owner, scope);
  const inMemory = memory.get(key);
  if (inMemory) return inMemory;
  const stored = readStored(owner).find((entry) => entry.scope === scope);
  if (!stored) return undefined;
  const { scope: _scope, ...list } = stored;
  memory.set(key, list);
  return list;
};

/** Without a known user nothing is kept, so it can never be read back by someone else. */
export const writeCachedDeployments = (scope: string, list: CachedDeploymentList): void => {
  const owner = currentOwner();
  if (!owner) {
    removeStored();
    return;
  }
  memory.set(memoryKey(owner, scope), list);
  const entry: StoredEntry = { ...list, scope, deployments: list.deployments.map(forStorage) };
  writeStored(
    owner,
    [entry, ...readStored(owner).filter((stored) => stored.scope !== scope)].slice(
      0,
      MAX_STORED_SCOPES,
    ),
  );
};

/** Called on session teardown so one user's deployments are never drawn for the next. */
export const clearDeploymentListCache = (): void => {
  memory.clear();
  removeStored();
};
