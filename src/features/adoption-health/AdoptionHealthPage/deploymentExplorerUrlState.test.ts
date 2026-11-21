import {
  DEFAULT_SORTING,
  parseExplorerState,
  writeExplorerState,
  type ExplorerGridState,
} from './deploymentExplorerUrlState';

const emptyState: ExplorerGridState = {
  globalFilter: '',
  columnFilters: [],
  sorting: DEFAULT_SORTING,
  grouping: [],
  pagination: { pageIndex: 0, pageSize: 25 },
  hiddenColumns: [],
  density: 'compact',
};

const roundTrip = (state: ExplorerGridState, base = '') => {
  const params = new URLSearchParams(base);
  writeExplorerState(params, state);
  return { params, parsed: parseExplorerState(params) };
};

describe('explorer URL state', () => {
  it('writes nothing for the default state', () => {
    const { params, parsed } = roundTrip(emptyState);

    expect(params.toString()).toBe('');
    expect(parsed).toEqual(emptyState);
  });

  it('round-trips search, filters, sorting, grouping, and paging', () => {
    const state: ExplorerGridState = {
      globalFilter: 'edge ingress',
      columnFilters: [
        { id: 'region', value: 'eu-west-1' },
        { id: 'moduleVersion', value: { operator: '>', value: '1.4.2', upperValue: '' } },
        {
          id: 'stackVersion',
          value: { operator: 'between', value: '3.0.0', upperValue: '4.0.0-rc.1+build.5' },
        },
      ],
      sorting: [
        { id: 'region', desc: true },
        { id: 'status', desc: false },
      ],
      grouping: ['environment', 'region'],
      pagination: { pageIndex: 2, pageSize: 50 },
      hiddenColumns: ['stackName', 'status'],
      density: 'spacious',
    };

    const { params, parsed } = roundTrip(state);

    expect(parsed).toEqual(state);
    expect(params.get('f.moduleVersion')).toBe('gt:1.4.2');
    expect(params.get('page')).toBe('3');
    expect(params.get('hide')).toBe('stackName,status');
    expect(params.get('density')).toBe('spacious');
  });

  it('keeps a version operator that has no value yet', () => {
    const state: ExplorerGridState = {
      ...emptyState,
      columnFilters: [{ id: 'moduleVersion', value: { operator: '<', value: '', upperValue: '' } }],
    };

    expect(roundTrip(state).parsed.columnFilters).toEqual(state.columnFilters);
  });

  it('tells a cleared sort apart from the default sort', () => {
    const { params, parsed } = roundTrip({ ...emptyState, sorting: [] });

    expect(params.get('sort')).toBe('');
    expect(parsed.sorting).toEqual([]);
  });

  it('keeps parameters that are not grid state and drops stale grid parameters', () => {
    const { params } = roundTrip(
      emptyState,
      'account=project-ember&moduleUsageMode=standalone&q=old&f.region=old&page=4',
    );

    expect(params.toString()).toBe('account=project-ember&moduleUsageMode=standalone');
  });

  it('lists hidden columns in column order and ignores unknown ones', () => {
    const parsed = parseExplorerState(new URLSearchParams('hide=status,nope,region'));

    expect(parsed.hiddenColumns).toEqual(['region', 'status']);
  });

  it('falls back to the default density for an unknown value', () => {
    expect(parseExplorerState(new URLSearchParams('density=huge')).density).toBe('compact');
  });

  it('ignores unknown columns, bad operators, and invalid paging', () => {
    const parsed = parseExplorerState(
      new URLSearchParams(
        'f.nope=x&f.moduleVersion=wat:1&sort=nope:desc&group=nope&page=-2&pageSize=7',
      ),
    );

    expect(parsed).toEqual({ ...emptyState, sorting: [] });
  });

  it.each(['toString', 'constructor', '__proto__', 'hasOwnProperty'])(
    'ignores the inherited object key %s as a version operator',
    (code) => {
      const parsed = parseExplorerState(new URLSearchParams(`f.moduleVersion=${code}:0.0.0`));

      expect(parsed.columnFilters).toEqual([]);
    },
  );
});
