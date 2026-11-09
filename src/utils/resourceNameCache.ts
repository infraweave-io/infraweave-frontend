/**
 * Remembers which modules/stacks exist, so a revisit can draw the full table
 * immediately instead of growing it row by row as pages arrive.
 *
 * Only names are cached, never versions. Names are stable, whereas a version is
 * both short-lived and load-bearing — it is part of the detail-page URL, so a
 * stale one would render a link to a version that no longer exists. Versions are
 * therefore always fetched, and their cells show a skeleton until they arrive.
 */

const KEY_PREFIX = 'infraweave.resource-names.v1';

export type ResourceKind = 'module' | 'stack';

export interface CachedResourceName {
  /** Registry identifier, used in links. */
  module: string;
  /** Human-facing name, used for display and sorting. */
  module_name: string;
}

const cacheKey = (kind: ResourceKind): string => `${KEY_PREFIX}.${kind}`;

export const readCachedNames = (kind: ResourceKind): CachedResourceName[] => {
  try {
    const raw = localStorage.getItem(cacheKey(kind));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is CachedResourceName =>
        typeof (entry as CachedResourceName)?.module === 'string' &&
        typeof (entry as CachedResourceName)?.module_name === 'string',
    );
  } catch {
    // Corrupt JSON, or storage blocked entirely (private mode / disabled
    // cookies). A cache miss is always an acceptable outcome here.
    return [];
  }
};

export const writeCachedNames = (kind: ResourceKind, names: CachedResourceName[]): void => {
  try {
    localStorage.setItem(cacheKey(kind), JSON.stringify(names));
  } catch {
    // Over quota, or storage blocked. Purely an optimisation — drop it.
  }
};

/**
 * Drops the remembered names. Called on every teardown of a session:
 *
 * - switching between mock and real backends, whose registries are disjoint, so
 *   mock names must not be drawn against a real API;
 * - logout and the 401 path, since which modules exist is user-scoped — on a
 *   shared browser these rows would otherwise be drawn for the next user before
 *   any request of theirs resolves.
 */
export const clearResourceNameCache = (): void => {
  try {
    localStorage.removeItem(cacheKey('module'));
    localStorage.removeItem(cacheKey('stack'));
  } catch {
    // Nothing to do — see above.
  }
};
