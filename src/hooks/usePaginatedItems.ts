import { useEffect, useState } from 'react';
import { useConfig } from './useConfig';

/**
 * Safety net so a pathologically large collection can never turn one page load
 * into an unbounded number of requests.
 */
const MAX_PAGES = 100;

const withNextToken = (path: string, nextToken: string): string =>
  `${path}${path.includes('?') ? '&' : '?'}next_token=${encodeURIComponent(nextToken)}`;

export interface PaginatedItems<T> {
  /** Items loaded so far. Grows as each page arrives. */
  items: T[];
  /** True until the final page has arrived. */
  loading: boolean;
  /**
   * Set when paging stopped with pages still outstanding, so `items` is known to
   * be incomplete. Callers must surface this: a truncated list that reports
   * `loading: false` is the silent truncation this hook exists to fix.
   */
  truncated?: boolean;
  error?: Error;
}

/**
 * Loads every item of a list endpoint, following the `x-next-token` response
 * header until the collection is exhausted, and publishing each page as it
 * arrives so the caller can render results progressively.
 *
 * The API is backed by DynamoDB, which caps a single query at 1 MB scanned and
 * returns a continuation token for the remainder. A plain one-shot fetch
 * therefore silently renders only the first page once a table outgrows that
 * limit — which happens quickly for module and stack records, since each one
 * carries its full variable, output and manifest payload.
 *
 * @param path API path relative to the backend, e.g.
 *   `api/proxy/api/infraweave/api/v1/stacks`. Existing query params are kept.
 *   Pass `null` to skip fetching.
 * @param label What the caller is fetching, e.g. `modules`, used in the error
 *   message the user sees. Defaults to the path, which is fine for a developer
 *   but names the whole URL, query string included.
 */
export const usePaginatedItems = <T>(path: string | null, label?: string): PaginatedItems<T> => {
  const config = useConfig();
  const [state, setState] = useState<PaginatedItems<T>>({ items: [], loading: path !== null });
  // `loading` above is only the initial value, so a null -> path transition would
  // otherwise render one frame of "loaded, empty" before the effect runs — long
  // enough for a caller to show its own "nothing found" empty state. Adjust the
  // state during render instead of waiting for the effect.
  const [loadedPath, setLoadedPath] = useState(path);
  if (loadedPath !== path) {
    setLoadedPath(path);
    setState({ items: [], loading: path !== null });
  }

  useEffect(() => {
    if (path === null) {
      setState({ items: [], loading: false });
      return undefined;
    }

    let cancelled = false;
    setState({ items: [], loading: true });

    const load = async () => {
      const items: T[] = [];
      let nextToken: string | null = null;
      // A backend that ignores `next_token` and keeps returning one would turn
      // this into MAX_PAGES requests that each append page 1. Same guard as
      // `Logs.tsx` uses on its forward token.
      const seenTokens = new Set<string>();

      for (let page = 0; page < MAX_PAGES; page++) {
        const url = config.getApiUrl(nextToken ? withNextToken(path, nextToken) : path);
        const response = await config.fetch(url);
        if (cancelled) return;

        if (response.status >= 300 && response.status < 400) {
          throw new Error('Redirected to login or guest page');
        }
        if (!response.ok) {
          // Include the status: a bare "failed to fetch" can't distinguish an
          // expired token (401) from a dev-proxy that can't reach the backend.
          const body = await response.text().catch(() => '');
          throw new Error(
            `Failed to fetch ${label ?? path}: HTTP ${response.status} ${response.statusText}` +
              (body ? ` — ${body.slice(0, 200)}` : ''),
          );
        }

        const json = await response.json();
        const pageItems = json?.Items ?? json?.items ?? json;
        if (!Array.isArray(pageItems)) {
          // Fail fast rather than paging on: silently ignoring the page would
          // render an empty list and hide the contract violation behind it.
          throw new Error(
            `Failed to fetch ${label ?? path}: expected a list of items, got ${typeof pageItems}`,
          );
        }
        items.push(...(pageItems as T[]));

        // Header lookups are case-insensitive per the Fetch spec.
        nextToken = response.headers.get('x-next-token');
        if (cancelled) return;

        // A token that doesn't advance means the backend isn't paging; stopping is
        // the only safe move, and it leaves the list incomplete just as MAX_PAGES does.
        let repeatedToken = false;
        if (nextToken && seenTokens.has(nextToken)) {
          console.warn(`Backend returned a repeated next_token for ${path}; stopping`);
          repeatedToken = true;
          nextToken = null;
        } else if (nextToken) {
          seenTokens.add(nextToken);
        }

        const more = Boolean(nextToken) && page < MAX_PAGES - 1;
        const hitPageLimit = Boolean(nextToken) && !more;
        if (hitPageLimit) {
          // Don't truncate silently — that is the very bug this hook exists to fix.
          // `truncated` carries it to the caller; the console line is for developers.
          console.warn(
            `Stopped loading ${path} after ${MAX_PAGES} pages (${items.length} items); the list may be incomplete`,
          );
        }

        setState({
          items: [...items],
          loading: more,
          truncated: hitPageLimit || repeatedToken,
        });
        if (!more) return;
      }
    };

    load().catch((error: Error) => {
      if (!cancelled) {
        // Keep the pages already loaded: a failure on page 7 shouldn't discard six
        // good ones. Callers show the error beside the rows they have.
        setState((prev) => ({
          items: prev.items,
          loading: false,
          truncated: prev.truncated,
          error,
        }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [config, path, label]);

  return state;
};

export default usePaginatedItems;
