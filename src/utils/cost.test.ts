import { AccountCosts, DeploymentCost } from '../types/Cost';
import {
  aggregateAccountCosts,
  breakdownTagKey,
  chunkForQuery,
  emptyGroupLabel,
  assignSeriesSlots,
  buildBreakdownChart,
  costQueryString,
  buildCostChart,
  costGroupLabel,
  formatCost,
  formatCostPeriod,
  formatCostTick,
  topCostLabels,
} from './cost';

const cost = (overrides: Partial<DeploymentCost> = {}): DeploymentCost => ({
  project_id: '123456789012',
  region: 'us-west-2',
  environment: 'cli/default',
  deployment_id: 's3bucket/bucket1',
  tag_key: 'INFRAWEAVE_DEPLOYMENT_ID',
  tag_value: 's3bucket/bucket1',
  granularity: 'DAILY',
  metric: 'UnblendedCost',
  group_by: ['SERVICE'],
  start: '2026-10-01',
  end: '2026-10-03',
  unit: 'USD',
  total: 6,
  groups: [
    { keys: ['Amazon S3'], amount: 3 },
    { keys: ['AWS KMS'], amount: 2 },
    { keys: ['Amazon CloudWatch'], amount: 1 },
  ],
  periods: [
    {
      start: '2026-10-01',
      end: '2026-10-02',
      estimated: false,
      total: 4,
      groups: [
        { keys: ['Amazon S3'], amount: 2 },
        { keys: ['AWS KMS'], amount: 1.5 },
        { keys: ['Amazon CloudWatch'], amount: 0.5 },
      ],
    },
    {
      start: '2026-10-02',
      end: '2026-10-03',
      estimated: true,
      total: 2,
      groups: [
        { keys: ['Amazon S3'], amount: 1 },
        { keys: ['AWS KMS'], amount: 0.5 },
        { keys: ['Amazon CloudWatch'], amount: 0.5 },
      ],
    },
  ],
  ...overrides,
});

describe('formatCost', () => {
  it('shows cents, and a tiny cost as more than nothing', () => {
    expect(formatCost(1234.5)).toBe('$1,234.50');
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(0.0001)).toBe('< $0.01');
  });

  it('falls back to the raw unit when it is not a currency', () => {
    expect(formatCost(2, 'Credits')).toBe('2.00 Credits');
  });
});

describe('formatCostTick', () => {
  it('keeps axis ticks short', () => {
    expect(formatCostTick(600)).toBe('$600');
    expect(formatCostTick(1250)).toBe('$1.3K');
    expect(formatCostTick(0.25)).toBe('$0.25');
  });
});

describe('formatCostPeriod', () => {
  it('labels periods in UTC at the granularity', () => {
    expect(formatCostPeriod('2026-10-01', 'MONTHLY')).toBe('Oct 2026');
    expect(formatCostPeriod('2026-10-13', 'DAILY')).toBe('Oct 13');
    // ICU separates AM/PM with a narrow no-break space in newer versions.
    expect(formatCostPeriod('2026-10-13T05:00:00Z', 'HOURLY')).toMatch(/^Oct 13, 05:00\sAM$/);
  });
});

describe('costGroupLabel', () => {
  it('joins the values of several dimensions', () => {
    expect(costGroupLabel(['Amazon S3', 'us-west-2'])).toBe('Amazon S3 · us-west-2');
    expect(costGroupLabel([''])).toBe('(none)');
  });
});

describe('assignSeriesSlots', () => {
  it('keeps the slot a label had before', () => {
    const first = assignSeriesSlots(['A', 'B', 'C'], new Map());
    expect([...first.assigned]).toEqual([
      ['A', 0],
      ['B', 1],
      ['C', 2],
    ]);

    const second = assignSeriesSlots(['C', 'D', 'A'], first.remembered);
    expect(second.assigned.get('A')).toBe(0);
    expect(second.assigned.get('C')).toBe(2);
    expect(second.assigned.get('D')).toBe(1);
  });
});

describe('buildCostChart', () => {
  it('folds the groups past the top ones into Other', () => {
    const c = cost();
    const chart = buildCostChart(c, topCostLabels(c, 2));

    expect(chart.series.map((s) => s.label)).toEqual(['Amazon S3', 'AWS KMS', 'Other']);
    expect(chart.rows[0]).toEqual({ period: 'Oct 1', s0: 2, s1: 1.5, other: 0.5 });
  });

  it('charts the period totals when the cost is not grouped', () => {
    const c = cost({ group_by: [], groups: [] });
    const chart = buildCostChart(c, []);

    expect(chart.series).toEqual([{ key: 'total', label: 'Total' }]);
    expect(chart.rows.map((r) => r.total)).toEqual([4, 2]);
  });
});

const account = (projectId: string, overrides: Partial<AccountCosts> = {}): AccountCosts => ({
  tag_key: 'INFRAWEAVE_DEPLOYMENT_ID',
  project_id: projectId,
  granularity: 'DAILY',
  start: '2026-10-01',
  end: '2026-10-03',
  metric: 'UnblendedCost',
  group_by: null,
  unit: 'USD',
  estimated: false,
  total: 6,
  deployments: [
    { deployment_id: 's3bucket/a', amount: 4 },
    { deployment_id: 'ec2/b', amount: 2 },
  ],
  periods: [
    {
      start: '2026-10-01',
      end: '2026-10-02',
      estimated: false,
      total: 5,
      deployments: [
        { deployment_id: 's3bucket/a', amount: 3 },
        { deployment_id: 'ec2/b', amount: 2 },
      ],
    },
    {
      start: '2026-10-02',
      end: '2026-10-03',
      estimated: false,
      total: 1,
      deployments: [{ deployment_id: 's3bucket/a', amount: 1 }],
    },
  ],
  ...overrides,
});

const describe_ = {
  projectName: (id: string) => ({ '111': 'Dev', '222': 'Prod' })[id] ?? id,
  deployment: (projectId: string, deploymentId: string) =>
    deploymentId === 's3bucket/a'
      ? { module: 's3bucket', environment: projectId === '111' ? 'dev' : 'prod' }
      : undefined,
};

describe('aggregateAccountCosts', () => {
  const results = [
    { projectId: '111', costs: account('111') },
    {
      projectId: '222',
      costs: account('222', {
        total: 1,
        deployments: [{ deployment_id: 's3bucket/a', amount: 1 }],
        periods: [],
      }),
    },
  ];

  it('totals accounts and counts each deployment of each account once', () => {
    const byAccount = aggregateAccountCosts(results, 'account', describe_);
    expect(byAccount.total).toBe(7);
    expect(byAccount.deploymentCount).toBe(3);
    expect(byAccount.rows.map((r) => [r.label, r.amount])).toEqual([
      ['Dev', 6],
      ['Prod', 1],
    ]);
  });

  it('keeps the same deployment id in two accounts apart', () => {
    const rows = aggregateAccountCosts(results, 'deployment', describe_).rows;
    expect(rows.map((r) => r.key)).toEqual(['111|s3bucket/a', '111|ec2/b', '222|s3bucket/a']);
  });

  it('groups by module and environment, falling back for deployments it does not know', () => {
    expect(aggregateAccountCosts(results, 'module', describe_).rows.map((r) => r.key)).toEqual([
      's3bucket',
      'ec2',
    ]);
    expect(
      aggregateAccountCosts(results, 'environment', describe_).rows.map((r) => [r.key, r.amount]),
    ).toEqual([
      ['dev', 4],
      ['Unknown environment', 2],
      ['prod', 1],
    ]);
  });

  it('uses the groups Cost Explorer returned for a dimension', () => {
    const grouped = account('111', {
      group_by: 'SERVICE',
      groups: [
        { key: 'Amazon S3', amount: 4 },
        { key: 'Amazon EC2', amount: 2 },
      ],
      periods: [
        {
          start: '2026-10-01',
          end: '2026-10-02',
          estimated: false,
          total: 6,
          deployments: [],
          groups: [
            { key: 'Amazon S3', amount: 4 },
            { key: 'Amazon EC2', amount: 2 },
          ],
        },
      ],
    });
    const costs = aggregateAccountCosts(
      [{ projectId: '111', costs: grouped }],
      'SERVICE',
      describe_,
    );
    expect(costs.rows.map((r) => r.key)).toEqual(['Amazon S3', 'Amazon EC2']);

    const chart = buildBreakdownChart(costs, [costs.rows[0]], 'DAILY');
    expect(chart.series.map((s) => s.label)).toEqual(['Amazon S3', 'Other']);
    expect(chart.rows[0]).toEqual({ period: 'Oct 1', s0: 4, other: 2 });
  });
});

describe('costQueryString', () => {
  it('leaves out unset values and joins lists', () => {
    expect(
      costQueryString({
        granularity: 'DAILY',
        group_by: undefined,
        services: ['a', 'b'],
        regions: [],
      }),
    ).toBe('granularity=DAILY&services=a%2Cb');
  });
});

describe('tag breakdowns', () => {
  it('reads the tag key and names costs without the tag', () => {
    expect(breakdownTagKey('tag:team')).toBe('team');
    expect(breakdownTagKey('SERVICE')).toBeUndefined();
    expect(emptyGroupLabel('tag:team')).toBe('No team tag');
    expect(emptyGroupLabel('REGION')).toBe('(none)');
  });
});

describe('chunkForQuery', () => {
  it('splits by count and by encoded length', () => {
    expect(chunkForQuery(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);

    const long = Array.from({ length: 10 }, (_, i) => `module/deployment-with-a-long-name-${i}`);
    const chunks = chunkForQuery(long, 100, 200);
    expect(chunks.flat()).toEqual(long);
    for (const chunk of chunks) {
      expect(encodeURIComponent(chunk.join(',')).length).toBeLessThanOrEqual(200);
    }
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('keeps a value longer than the limit on its own rather than dropping it', () => {
    expect(chunkForQuery(['x'.repeat(50), 'y'], 100, 10)).toEqual([['x'.repeat(50)], ['y']]);
    expect(chunkForQuery([], 100)).toEqual([]);
  });
});
