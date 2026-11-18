/**
 * Pages the user opened recently, newest first. Written on every route change by
 * `RecordVisits` and read by the Recently visited widget, which is not mounted while the
 * user browses, so the recording cannot live in the widget.
 */

import { currentOwner, readOwned, writeOwned } from './ownedStorage';

// A localStorage key name, not a credential; gitleaks' generic-api-key rule misreads it.
const STORAGE_KEY = 'infraweave.recentVisits.v1'; // gitleaks:allow

/** Enough for any widget size; older visits fall off the end. */
const MAX_VISITS = 50;

const VISIT_KINDS = ['tab', 'deployment', 'module', 'stack', 'policy', 'provider'] as const;

export type VisitKind = (typeof VISIT_KINDS)[number];

export type Visit = {
  /** Identifies the page, so a revisit moves it to the top instead of adding a duplicate. */
  key: string;
  /** The route as visited, to link back to. */
  path: string;
  kind: VisitKind;
  label: string;
  detail?: string;
  /** Epoch ms of the latest visit. */
  at: number;
};

/** The Overview itself is left out: it is where the widget is shown. */
const TAB_LABELS: Record<string, string> = {
  deployments: 'Deployments',
  stacks: 'Stacks',
  modules: 'Modules',
  providers: 'Providers',
  policies: 'Policies',
  projects: 'Projects',
  'adoption-health': 'Adoption & Health',
};

const safeDecode = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/** Null for routes not worth listing: the Overview, login callbacks, unknown paths. */
const describeRoute = (pathname: string): Omit<Visit, 'at'> | null => {
  const [root, section, ...rest] = pathname.split('/').filter(Boolean).map(safeDecode);
  if (root !== 'infraweave' || !section) return null;

  switch (section) {
    case 'deployment': {
      const [project, region, environment, deploymentId] = rest;
      if (!deploymentId) return null;
      return {
        // The trailing tab (logs, changes, ...) is the same deployment.
        key: `deployment/${project}/${region}/${environment}/${deploymentId}`,
        path: pathname,
        kind: 'deployment',
        label: deploymentId,
        detail: `${project} · ${region} · ${environment}`,
      };
    }
    case 'module':
    case 'stack':
    case 'provider': {
      const [track, name, version] = rest;
      if (!version) return null;
      return {
        key: `${section}/${track}/${name}/${version}`,
        path: pathname,
        kind: section,
        label: name,
        detail: `${version} · ${track}`,
      };
    }
    case 'policy': {
      const [environment, name, version] = rest;
      if (!version) return null;
      return {
        key: `policy/${environment}/${name}/${version}`,
        path: pathname,
        kind: 'policy',
        label: name,
        detail: `${version} · ${environment}`,
      };
    }
    default: {
      const label = TAB_LABELS[section];
      if (!label) return null;
      // Adoption & Health views share one entry; the link reopens the view last seen.
      if (section !== 'adoption-health' && rest.length > 0) return null;
      return { key: `tab/${section}`, path: pathname, kind: 'tab', label };
    }
  }
};

const EMPTY: Visit[] = [];

// useSyncExternalStore needs the same array back until something changes.
let cache: { owner: string | null; visits: Visit[] } | null = null;
const listeners = new Set<() => void>();

const isText = (value: unknown): value is string => typeof value === 'string';

/** Storage can be edited or left by an older version, so every entry is checked before use. */
const isVisit = (entry: unknown): entry is Visit => {
  const { key, path, kind, label, detail, at } = (entry ?? {}) as Partial<Visit>;
  return (
    isText(key) &&
    isText(path) &&
    path.startsWith('/infraweave/') &&
    VISIT_KINDS.includes(kind as VisitKind) &&
    isText(label) &&
    (detail === undefined || isText(detail)) &&
    typeof at === 'number'
  );
};

const readStored = (): Visit[] => {
  const stored = readOwned(STORAGE_KEY);
  return Array.isArray(stored) ? stored.filter(isVisit) : EMPTY;
};

export const getVisits = (): Visit[] => {
  const owner = currentOwner();
  if (!cache || cache.owner !== owner) cache = { owner, visits: owner ? readStored() : EMPTY };
  return cache.visits;
};

export const subscribeToVisits = (listener: () => void): (() => void) => {
  listeners.add(listener);
  // Another tab recorded a visit.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

export const recordVisit = (pathname: string, now = Date.now()): void => {
  const page = describeRoute(pathname);
  const owner = currentOwner();
  // Without a known owner nothing is stored, so it can never be read back by someone else.
  if (!page || !owner) return;

  const visits = [
    { ...page, at: now },
    ...getVisits().filter((visit) => visit.key !== page.key),
  ].slice(0, MAX_VISITS);
  cache = { owner, visits };
  writeOwned(STORAGE_KEY, visits);
  listeners.forEach((listener) => listener());
};
