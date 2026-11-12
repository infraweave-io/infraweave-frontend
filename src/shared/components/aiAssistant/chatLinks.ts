/**
 * Decides whether a link in an assistant reply points at a page this app really has. The model
 * writes the links, so anything it gets wrong must not turn into a clickable dead end.
 *
 * Keep in step with the routes in StandaloneApp, the tabs in RootPage and DeploymentPage, the
 * views in AdoptionHealthPage and the filters in usageContext.
 */

const ROOT_TABS = [
  'overview',
  'deployments',
  'stacks',
  'modules',
  'providers',
  'policies',
  'projects',
  'adoption-health',
];

/** `usage` is left out on purpose: it only redirects to `module-usage`. */
const ADOPTION_HEALTH_VIEWS = [
  'module-usage',
  'stack-usage',
  'deployment-explorer',
  'region-usage',
  'account-usage',
  'velocity',
  'health',
  'issues',
];

/** The views that read their selection from the query. */
const USAGE_VIEWS = ['module-usage', 'stack-usage', 'region-usage', 'account-usage'];

const USAGE_FILTERS = ['module', 'kind', 'region', 'account', 'moduleUsageMode'];

const USAGE_MODES = ['standalone', 'in-stacks', 'both'];

const DEPLOYMENT_TABS = ['overview', 'events'];

const PREFIX = '/infraweave/';

const decodes = (segment: string): boolean => {
  try {
    const decoded = decodeURIComponent(segment);
    return decoded !== '' && decoded !== '.' && decoded !== '..';
  } catch {
    return false;
  }
};

const validQuery = (view: string, query: string): boolean => {
  if (query === '') return true;
  if (!USAGE_VIEWS.includes(view)) return false;
  const params = new URLSearchParams(query);
  const keys = Array.from(params.keys());
  if (new Set(keys).size !== keys.length) return false;
  if (!keys.every((key) => USAGE_FILTERS.includes(key))) return false;
  const kind = params.get('kind');
  const mode = params.get('moduleUsageMode');
  return (
    (kind === null || kind === 'module' || kind === 'stack') &&
    (mode === null || USAGE_MODES.includes(mode))
  );
};

/**
 * Returns the in-app path (with the query the usage pages read) for a link to a real page, and
 * `null` for everything else. A hash and a trailing slash are dropped.
 */
export const resolveInternalLink = (href: string | undefined): string | null => {
  if (!href || !href.startsWith(PREFIX)) return null;

  const [beforeHash] = href.split('#');
  const queryStart = beforeHash.indexOf('?');
  const rawPath = queryStart === -1 ? beforeHash : beforeHash.slice(0, queryStart);
  const query = queryStart === -1 ? '' : beforeHash.slice(queryStart + 1);

  const path = rawPath.replace(/\/$/, '');
  const segments = path.slice(PREFIX.length).split('/');
  if (!segments.every(decodes)) return null;

  const [first, ...rest] = segments;
  const withQuery = query ? `${path}?${query}` : path;

  switch (first) {
    case 'deployment': {
      // project / region / environment / deployment id, then an optional tab.
      if ((rest.length !== 4 && rest.length !== 5) || query) return null;
      const tab = rest[4];
      return tab === undefined || DEPLOYMENT_TABS.includes(tab) ? path : null;
    }
    case 'module':
    case 'stack':
    case 'provider':
    case 'policy':
      return rest.length === 3 && !query ? path : null;
    case 'adoption-health': {
      if (segments.length === 1) return validQuery(first, query) ? withQuery : null;
      const [view, ...extra] = rest;
      if (extra.length > 0 || !ADOPTION_HEALTH_VIEWS.includes(view)) return null;
      return validQuery(view, query) ? withQuery : null;
    }
    default:
      return segments.length === 1 && ROOT_TABS.includes(first) && !query ? path : null;
  }
};
