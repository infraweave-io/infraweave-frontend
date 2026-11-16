import { Deployment } from '../../../types/Deployment';
import { byAccount, byRegion, regionName, summarizeGroup, summarizeGroups } from './fleetSummary';

const ALICE = '111111111111';
const BOB = '222222222222';

const deployment = (overrides: Partial<Deployment>): Deployment =>
  ({
    project_id: ALICE,
    region: 'us-west-2',
    module: 's3bucket',
    module_type: 'module',
    module_version: '1.0.0',
    status: 'successful',
    error_text: '',
    ...overrides,
  }) as Deployment;

const isStack = (d: Deployment) => d.module_type === 'stack';

describe('summarizeGroups', () => {
  const fleet = [
    deployment({}),
    deployment({ project_id: BOB, module: 'vpc' }),
    deployment({ module: 'webapp', module_type: 'stack', status: 'failed' }),
    deployment({ region: 'eu-west-1' }),
  ];

  it('ranks regions by deployments, with counts per region', () => {
    const rows = summarizeGroups(fleet, byRegion, ['us-west-2', 'eu-west-1'], isStack);

    expect(rows).toEqual([
      { key: 'us-west-2', count: 3, accounts: 2, regions: 1, modules: 2, stacks: 1, failing: 1 },
      { key: 'eu-west-1', count: 1, accounts: 1, regions: 1, modules: 1, stacks: 0, failing: 0 },
    ]);
  });

  it('ranks accounts the same way, counting the regions each uses', () => {
    const rows = summarizeGroups(fleet, byAccount, [ALICE, BOB], isStack);

    expect(rows).toEqual([
      { key: ALICE, count: 3, accounts: 1, regions: 2, modules: 1, stacks: 1, failing: 1 },
      { key: BOB, count: 1, accounts: 1, regions: 1, modules: 1, stacks: 0, failing: 0 },
    ]);
  });

  it('keeps configured groups that have no deployments, at the bottom', () => {
    const rows = summarizeGroups([deployment({})], byAccount, [BOB, ALICE], isStack);

    expect(rows.map((row) => [row.key, row.count])).toEqual([
      [ALICE, 1],
      [BOB, 0],
    ]);
  });

  it('adds a group that only the deployments mention', () => {
    const rows = summarizeGroups([deployment({ region: 'eu-north-1' })], byRegion, [], isStack);

    expect(rows.map((row) => row.key)).toEqual(['eu-north-1']);
  });
});

describe('summarizeGroup', () => {
  it('breaks a region down by module or stack and by account', () => {
    const summary = summarizeGroup(
      [
        deployment({ module_version: '1.0.0' }),
        deployment({ project_id: BOB, module_version: '1.1.0', status: 'failed' }),
        deployment({ module: 'webapp', module_type: 'stack', has_drifted: true }),
      ],
      isStack,
      byAccount,
    );

    expect(summary).toMatchObject({
      total: 3,
      accounts: 2,
      regions: 1,
      modules: 1,
      stacks: 1,
      failing: 1,
      drifted: 1,
    });
    expect(summary.entryRows).toEqual([
      {
        name: 's3bucket',
        kind: 'module',
        count: 2,
        accounts: 2,
        regions: 1,
        versions: 2,
        failing: 1,
      },
      {
        name: 'webapp',
        kind: 'stack',
        count: 1,
        accounts: 1,
        regions: 1,
        versions: 1,
        failing: 0,
      },
    ]);
    expect(summary.breakdownRows.map((row) => [row.key, row.count, row.entries])).toEqual([
      [ALICE, 2, 2],
      [BOB, 1, 1],
    ]);
  });

  it('breaks an account down by region, keeping its configured but empty regions', () => {
    const summary = summarizeGroup(
      [deployment({}), deployment({ region: 'eu-west-1', module: 'vpc' })],
      isStack,
      byRegion,
      ['us-west-2', 'eu-west-1', 'ap-south-1'],
    );

    expect(summary.regions).toBe(2);
    expect(summary.entryRows.map((row) => [row.name, row.regions])).toEqual([
      ['s3bucket', 1],
      ['vpc', 1],
    ]);
    expect(summary.breakdownRows.map((row) => [row.key, row.count])).toEqual([
      ['eu-west-1', 1],
      ['us-west-2', 1],
      ['ap-south-1', 0],
    ]);
  });

  it('keeps a module and a stack of the same name apart', () => {
    const summary = summarizeGroup(
      [deployment({ module: 'shared' }), deployment({ module: 'shared', module_type: 'stack' })],
      isStack,
      byAccount,
    );

    expect(summary.entryRows.map((row) => row.kind).sort()).toEqual(['module', 'stack']);
    expect(summary.breakdownRows[0].entries).toBe(2);
  });
});

describe('regionName', () => {
  it('names the regions InfraWeave runs in and leaves others alone', () => {
    expect(regionName('eu-west-1')).toBe('Ireland');
    expect(regionName('mars-north-1')).toBeUndefined();
  });
});
