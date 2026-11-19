import { Deployment } from '../types/Deployment';
import { StatusKind, statusKind } from './deploymentStatus';

export type SortColumn =
  | 'name'
  | 'namespace'
  | 'account'
  | 'region'
  | 'status'
  | 'timestamp'
  | 'version'
  | 'cost';

export type SortDirection = 'asc' | 'desc';

/** One level of a sort; the list is applied in order, each breaking the ties of the one before. */
export interface SortKey {
  column: SortColumn;
  direction: SortDirection;
}

/**
 * The direction a column sorts in when first chosen: names A to Z, but the newest event, the
 * newest version and the largest cost first, since those are what one sorts them to find.
 * Status `asc` puts failures first.
 */
export const FIRST_DIRECTION: Record<SortColumn, SortDirection> = {
  name: 'asc',
  namespace: 'asc',
  account: 'asc',
  region: 'asc',
  status: 'asc',
  timestamp: 'desc',
  version: 'desc',
  cost: 'desc',
};

const flip = (direction: SortDirection): SortDirection => (direction === 'asc' ? 'desc' : 'asc');

/** A key's next state on a click: its first direction, then the other, then gone. */
const cycle = (column: SortColumn, key: SortKey | undefined): SortKey | undefined => {
  if (!key) return { column, direction: FIRST_DIRECTION[column] };
  if (key.direction === FIRST_DIRECTION[column]) return { column, direction: flip(key.direction) };
  return undefined;
};

/**
 * The sort after a header click. A plain click sorts by that column alone (or moves it on if it
 * already is the only one); with `adding` (Shift held) it is added after the current columns,
 * or moved on where it already is, so "status, then cost" is a click and a Shift+click.
 */
export const nextSort = (sort: SortKey[], column: SortColumn, adding: boolean): SortKey[] => {
  const index = sort.findIndex((k) => k.column === column);
  if (!adding) {
    const alone = sort.length === 1 && index === 0 ? sort[0] : undefined;
    const next = cycle(column, alone);
    return next ? [next] : [];
  }
  if (index < 0) return [...sort, { column, direction: FIRST_DIRECTION[column] }];
  const next = cycle(column, sort[index]);
  return next ? sort.map((k, i) => (i === index ? next : k)) : sort.filter((_, i) => i !== index);
};

/** Failures first, then what is still running, then the rest. */
const STATUS_RANK: Record<StatusKind, number> = {
  failed: 0,
  'in-progress': 1,
  unknown: 2,
  success: 3,
};

/** What a row shows for the columns that are not read off the deployment record as is. */
export interface SortValues {
  account: (d: Deployment) => string;
  /** Undefined while the cost is not known; such rows go last whichever way cost is sorted. */
  cost: (d: Deployment) => number | undefined;
}

const text = (a: string | undefined, b: string | undefined) =>
  (a ?? '').localeCompare(b ?? '', undefined, { numeric: true, sensitivity: 'base' });

const compare = (key: SortKey, a: Deployment, b: Deployment, values: SortValues): number => {
  const ordered = (result: number) => (key.direction === 'asc' ? result : -result);
  switch (key.column) {
    case 'name':
      return ordered(text(a.deployment_id.split('/').pop(), b.deployment_id.split('/').pop()));
    case 'namespace':
      return ordered(text(a.environment, b.environment));
    case 'account':
      return ordered(text(values.account(a), values.account(b)));
    case 'region':
      return ordered(text(a.region, b.region));
    case 'status':
      return ordered(
        STATUS_RANK[statusKind(a.status)] - STATUS_RANK[statusKind(b.status)] ||
          text(a.status, b.status),
      );
    case 'timestamp':
      return ordered((a.epoch || 0) - (b.epoch || 0));
    case 'version':
      return ordered(text(a.module_version, b.module_version));
    case 'cost': {
      const costA = values.cost(a);
      const costB = values.cost(b);
      if (costA === undefined || costB === undefined) {
        return (costA === undefined ? 1 : 0) - (costB === undefined ? 1 : 0);
      }
      return ordered(costA - costB);
    }
  }
};

/** `deployments` in the order of `sort`; ties, and no sort at all, keep the order given. */
export const sortDeployments = (
  deployments: Deployment[],
  sort: SortKey[],
  values: SortValues,
): Deployment[] => {
  if (sort.length === 0) return deployments;
  return [...deployments].sort((a, b) => {
    for (const key of sort) {
      const result = compare(key, a, b, values);
      if (result !== 0) return result;
    }
    return 0;
  });
};
