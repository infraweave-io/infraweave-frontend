import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  MRT_ColumnFiltersState,
  MRT_DensityState,
  MRT_GroupingState,
  MRT_PaginationState,
  MRT_SortingState,
  MRT_Updater,
  MRT_VisibilityState,
} from 'material-react-table';
import type { VersionFilterOperator, VersionFilterValue } from './deploymentExplorerVersionFilter';

/**
 * Grid state of the Deployment Explorer, kept in the URL so a view can be shared or bookmarked.
 *
 *   q=text               search box
 *   sort=region:desc,…   column order; `sort=` alone means no sorting
 *   group=region,…       grouped columns, outermost first
 *   f.<column>=text      column filter; version columns use `gt:1.2.3`, `lt:…`, `eq:…`,
 *                        or `between:1.0.0:2.0.0`
 *   page=3, pageSize=50  one-based page; each is omitted at its default
 *   hide=status,region   hidden columns
 *   density=spacious     row density; omitted for the default, `compact`
 */

export const EXPLORER_COLUMN_IDS = [
  'moduleName',
  'moduleVersion',
  'stackName',
  'stackVersion',
  'account',
  'region',
  'environment',
  'deploymentId',
  'status',
] as const;

const VERSION_COLUMN_IDS: readonly string[] = ['moduleVersion', 'stackVersion'];

export const DEFAULT_SORTING: MRT_SortingState = [{ id: 'moduleName', desc: false }];
export const DEFAULT_PAGE_SIZE = 25;
export const DEFAULT_DENSITY: MRT_DensityState = 'compact';
const DENSITIES: readonly MRT_DensityState[] = ['compact', 'comfortable', 'spacious'];
/** The sizes the page-size picker offers; the URL accepts no others. */
export const PAGE_SIZES = [5, 10, 25, 50, 100];

const FILTER_PREFIX = 'f.';

const OPERATOR_CODE: Record<VersionFilterOperator, string> = {
  '<': 'lt',
  '>': 'gt',
  '=': 'eq',
  between: 'between',
};
// A Map, because the code comes from the URL and a plain object would also answer for
// inherited keys such as `toString`.
const OPERATOR_BY_CODE = new Map<string, VersionFilterOperator>([
  ['lt', '<'],
  ['gt', '>'],
  ['eq', '='],
  ['between', 'between'],
]);

const isColumnId = (id: string): boolean => (EXPLORER_COLUMN_IDS as readonly string[]).includes(id);

export type ExplorerGridState = {
  globalFilter: string;
  columnFilters: MRT_ColumnFiltersState;
  sorting: MRT_SortingState;
  grouping: MRT_GroupingState;
  pagination: MRT_PaginationState;
  /** Columns the user hid, in column order. */
  hiddenColumns: string[];
  density: MRT_DensityState;
};

const encodeVersionFilter = (filter: VersionFilterValue): string => {
  const head = `${OPERATOR_CODE[filter.operator]}:${filter.value}`;
  return filter.operator === 'between' ? `${head}:${filter.upperValue ?? ''}` : head;
};

const decodeVersionFilter = (text: string): VersionFilterValue | undefined => {
  const split = text.indexOf(':');
  const operator = OPERATOR_BY_CODE.get(text.slice(0, split));
  if (split < 0 || !operator) return undefined;
  const rest = text.slice(split + 1);
  if (operator !== 'between') return { operator, value: rest, upperValue: '' };
  const upperSplit = rest.indexOf(':');
  return upperSplit < 0
    ? { operator, value: rest, upperValue: '' }
    : { operator, value: rest.slice(0, upperSplit), upperValue: rest.slice(upperSplit + 1) };
};

const positiveInt = (text: string | null): number | undefined => {
  const value = Number(text);
  return text !== null && Number.isInteger(value) && value > 0 ? value : undefined;
};

export const parseExplorerState = (params: URLSearchParams): ExplorerGridState => {
  const columnFilters: MRT_ColumnFiltersState = [];
  for (const [key, text] of params) {
    if (!key.startsWith(FILTER_PREFIX)) continue;
    const id = key.slice(FILTER_PREFIX.length);
    if (!isColumnId(id)) continue;
    if (VERSION_COLUMN_IDS.includes(id)) {
      const value = decodeVersionFilter(text);
      if (value) columnFilters.push({ id, value });
    } else if (text) {
      columnFilters.push({ id, value: text });
    }
  }

  const sortParam = params.get('sort');
  const sorting =
    sortParam === null
      ? DEFAULT_SORTING
      : sortParam
          .split(',')
          .map((entry) => {
            const [id, direction] = entry.split(':');
            return { id, desc: direction === 'desc' };
          })
          .filter(({ id }) => isColumnId(id));

  const grouping = (params.get('group') ?? '').split(',').filter(isColumnId);

  const hidden = (params.get('hide') ?? '').split(',');

  const requestedSize = positiveInt(params.get('pageSize'));
  const pageSize =
    requestedSize && PAGE_SIZES.includes(requestedSize) ? requestedSize : DEFAULT_PAGE_SIZE;
  const pageIndex = (positiveInt(params.get('page')) ?? 1) - 1;

  return {
    globalFilter: params.get('q') ?? '',
    columnFilters,
    sorting,
    grouping,
    pagination: { pageIndex, pageSize },
    hiddenColumns: EXPLORER_COLUMN_IDS.filter((id) => hidden.includes(id)),
    density: DENSITIES.find((density) => density === params.get('density')) ?? DEFAULT_DENSITY,
  };
};

/** Writes `state` into `params`, leaving every parameter that is not grid state alone. */
export const writeExplorerState = (params: URLSearchParams, state: ExplorerGridState): void => {
  for (const key of Array.from(params.keys())) {
    if (key.startsWith(FILTER_PREFIX)) params.delete(key);
  }
  params.delete('q');
  params.delete('sort');
  params.delete('group');
  params.delete('page');
  params.delete('pageSize');
  params.delete('hide');
  params.delete('density');

  if (state.globalFilter) params.set('q', state.globalFilter);
  for (const { id, value } of state.columnFilters) {
    if (!isColumnId(id)) continue;
    if (VERSION_COLUMN_IDS.includes(id)) {
      params.set(FILTER_PREFIX + id, encodeVersionFilter(value as VersionFilterValue));
    } else if (typeof value === 'string' && value) {
      params.set(FILTER_PREFIX + id, value);
    }
  }
  const isDefaultSorting =
    state.sorting.length === DEFAULT_SORTING.length &&
    state.sorting.every(
      (sort, index) =>
        sort.id === DEFAULT_SORTING[index].id && sort.desc === DEFAULT_SORTING[index].desc,
    );
  if (!isDefaultSorting) {
    params.set(
      'sort',
      state.sorting.map(({ id, desc }) => `${id}:${desc ? 'desc' : 'asc'}`).join(','),
    );
  }
  if (state.grouping.length > 0) params.set('group', state.grouping.join(','));
  if (state.density !== DEFAULT_DENSITY) params.set('density', state.density);
  if (state.hiddenColumns.length > 0) params.set('hide', state.hiddenColumns.join(','));
  if (state.pagination.pageIndex > 0) params.set('page', String(state.pagination.pageIndex + 1));
  if (state.pagination.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set('pageSize', String(state.pagination.pageSize));
  }
};

const resolve = <T>(updater: MRT_Updater<T>, current: T): T =>
  typeof updater === 'function' ? (updater as (old: T) => T)(current) : updater;

/** A change that leaves the value as it was is not a change, and must not reset the page. */
const withFirstPage = (
  current: ExplorerGridState,
  next: Partial<ExplorerGridState>,
  key: 'globalFilter' | 'columnFilters' | 'sorting' | 'grouping',
): ExplorerGridState =>
  JSON.stringify(next[key]) === JSON.stringify(current[key])
    ? current
    : { ...current, ...next, pagination: { ...current.pagination, pageIndex: 0 } };

/** Grid state from the URL, and the change handlers that write it back. */
export const useExplorerUrlState = (forcedHidden: readonly string[] = []) => {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseExplorerState(params), [params]);
  // A forced column stays hidden whatever the URL says, and never enters the URL.
  const forcedKey = forcedHidden.join(',');
  const forced = useMemo(() => (forcedKey ? forcedKey.split(',') : []), [forcedKey]);
  const columnVisibility = useMemo(
    () =>
      Object.fromEntries(
        EXPLORER_COLUMN_IDS.map((id) => [
          id,
          !state.hiddenColumns.includes(id) && !forced.includes(id),
        ]),
      ),
    [state.hiddenColumns, forced],
  );

  // Several changes can land in one tick, for example a column hidden and its filter dropped.
  // Each one starts from the last state written, not the one of the last render.
  const latest = useRef(state);
  latest.current = state;

  const update = useCallback(
    (change: (current: ExplorerGridState) => ExplorerGridState) => {
      const next = change(latest.current);
      latest.current = next;
      setParams(
        (current) => {
          const nextParams = new URLSearchParams(current);
          writeExplorerState(nextParams, next);
          return nextParams;
        },
        // Filter edits replace the history entry, as the other in-page picks do.
        { replace: true },
      );
    },
    [setParams],
  );

  const handlers = useMemo(
    () => ({
      onGlobalFilterChange: (updater: MRT_Updater<string | undefined>) =>
        update((current) =>
          withFirstPage(
            current,
            { globalFilter: resolve(updater, current.globalFilter) ?? '' },
            'globalFilter',
          ),
        ),
      onColumnFiltersChange: (updater: MRT_Updater<MRT_ColumnFiltersState>) =>
        update((current) =>
          withFirstPage(
            current,
            { columnFilters: resolve(updater, current.columnFilters) },
            'columnFilters',
          ),
        ),
      onSortingChange: (updater: MRT_Updater<MRT_SortingState>) =>
        update((current) =>
          withFirstPage(current, { sorting: resolve(updater, current.sorting) }, 'sorting'),
        ),
      onGroupingChange: (updater: MRT_Updater<MRT_GroupingState>) =>
        update((current) =>
          withFirstPage(current, { grouping: resolve(updater, current.grouping) }, 'grouping'),
        ),
      onColumnVisibilityChange: (updater: MRT_Updater<MRT_VisibilityState>) =>
        update((current) => {
          const visibility = resolve(
            updater,
            Object.fromEntries(
              EXPLORER_COLUMN_IDS.map((id) => [
                id,
                !current.hiddenColumns.includes(id) && !forced.includes(id),
              ]),
            ),
          );
          return {
            ...current,
            hiddenColumns: EXPLORER_COLUMN_IDS.filter(
              (id) => visibility[id] === false && !forced.includes(id),
            ),
          };
        }),
      onDensityChange: (updater: MRT_Updater<MRT_DensityState>) =>
        update((current) => ({ ...current, density: resolve(updater, current.density) })),
      onPaginationChange: (updater: MRT_Updater<MRT_PaginationState>) =>
        update((current) => ({ ...current, pagination: resolve(updater, current.pagination) })),
    }),
    [update, forced],
  );

  const { hiddenColumns: _hidden, ...gridState } = state;
  return { state: { ...gridState, columnVisibility }, handlers };
};
