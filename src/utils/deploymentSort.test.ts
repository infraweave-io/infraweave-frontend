import { Deployment } from '../types/Deployment';
import { nextSort, sortDeployments, SortValues } from './deploymentSort';

const deployment = (id: string, status: string, overrides: Partial<Deployment> = {}) =>
  ({
    project_id: '111',
    region: 'us-west-2',
    environment: 'dev',
    deployment_id: `module/${id}`,
    module: 'module',
    module_version: '1.0.0',
    status,
    epoch: 0,
    ...overrides,
  }) as unknown as Deployment;

const costs: Record<string, number | undefined> = {
  'module/a': 5,
  'module/b': 50,
  'module/c': 20,
  'module/d': undefined,
};

const values: SortValues = {
  account: () => 'Dev',
  cost: (d) => costs[d.deployment_id],
};

const names = (list: Deployment[]) => list.map((d) => d.deployment_id.split('/').pop());

describe('nextSort', () => {
  it('cycles a column alone through its first direction, the other, and off', () => {
    let sort = nextSort([], 'cost', false);
    expect(sort).toEqual([{ column: 'cost', direction: 'desc' }]);
    sort = nextSort(sort, 'cost', false);
    expect(sort).toEqual([{ column: 'cost', direction: 'asc' }]);
    expect(nextSort(sort, 'cost', false)).toEqual([]);
  });

  it('replaces the sort on a plain click and adds to it on a Shift+click', () => {
    const byStatus = nextSort([], 'status', false);
    const thenCost = nextSort(byStatus, 'cost', true);
    expect(thenCost).toEqual([
      { column: 'status', direction: 'asc' },
      { column: 'cost', direction: 'desc' },
    ]);
    expect(nextSort(thenCost, 'name', false)).toEqual([{ column: 'name', direction: 'asc' }]);

    const flipped = nextSort(thenCost, 'cost', true);
    expect(flipped[1]).toEqual({ column: 'cost', direction: 'asc' });
    expect(nextSort(flipped, 'cost', true)).toEqual([{ column: 'status', direction: 'asc' }]);
  });
});

describe('sortDeployments', () => {
  const list = [
    deployment('a', 'successful'),
    deployment('b', 'successful'),
    deployment('c', 'failed_apply'),
    deployment('d', 'initiated'),
  ];

  it('puts failures first, then what is running, then the rest', () => {
    expect(names(sortDeployments(list, [{ column: 'status', direction: 'asc' }], values))).toEqual([
      'c',
      'd',
      'a',
      'b',
    ]);
  });

  it('breaks ties with the next column', () => {
    const sorted = sortDeployments(
      list,
      [
        { column: 'status', direction: 'asc' },
        { column: 'cost', direction: 'desc' },
      ],
      values,
    );
    expect(names(sorted)).toEqual(['c', 'd', 'b', 'a']);
  });

  it('keeps rows with no known cost last whichever way cost is sorted', () => {
    expect(names(sortDeployments(list, [{ column: 'cost', direction: 'desc' }], values))).toEqual([
      'b',
      'c',
      'a',
      'd',
    ]);
    expect(names(sortDeployments(list, [{ column: 'cost', direction: 'asc' }], values))).toEqual([
      'a',
      'c',
      'b',
      'd',
    ]);
  });

  it('sorts names and versions the way people read numbers', () => {
    const numbered = [
      deployment('pr10', 'successful', { module_version: '1.10.0' }),
      deployment('pr9', 'successful', { module_version: '1.9.0' }),
    ];
    expect(
      names(sortDeployments(numbered, [{ column: 'name', direction: 'asc' }], values)),
    ).toEqual(['pr9', 'pr10']);
    expect(
      names(sortDeployments(numbered, [{ column: 'version', direction: 'desc' }], values)),
    ).toEqual(['pr10', 'pr9']);
  });

  it('leaves the order alone with no sort', () => {
    expect(sortDeployments(list, [], values)).toBe(list);
  });
});
