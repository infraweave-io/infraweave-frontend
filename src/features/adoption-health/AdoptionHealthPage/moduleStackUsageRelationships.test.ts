import type { StackModuleUsage } from '../../../types/Deployment';
import { groupModuleStackUses } from './moduleStackUsageRelationships';

const use = (overrides: Partial<StackModuleUsage> = {}): StackModuleUsage =>
  ({
    module: 's3bucket',
    module_version: '2.8.0',
    stackName: 'webstack',
    stackTrack: 'stable',
    stackVersion: '1.2',
    project_id: 'team-a',
    region: 'eu-central-1',
    environment: 'prod',
    deployment_id: 'web-1',
    usageSource: 'stack',
    componentIndex: 0,
    ...overrides,
  }) as StackModuleUsage;

describe('groupModuleStackUses', () => {
  it('counts duplicate components once and keeps deployments in separate regions', () => {
    const relationships = groupModuleStackUses([
      use(),
      use({ componentIndex: 1 }),
      use({ project_id: 'team-b', region: 'us-west-2', deployment_id: 'web-2' }),
    ]);

    expect(relationships).toHaveLength(1);
    expect(relationships[0].deployments).toHaveLength(2);
    expect(
      relationships[0].deployments.map(({ project_id, region }) => [project_id, region]),
    ).toEqual([
      ['team-a', 'eu-central-1'],
      ['team-b', 'us-west-2'],
    ]);
  });

  it('keeps module versions, stack versions, and module names as separate relationships', () => {
    const relationships = groupModuleStackUses([
      use(),
      use({ module_version: '3.0.0' }),
      use({ stackVersion: '2.0.0' }),
      use({ module: 'vpc', module_version: '1.0.0' }),
    ]);

    expect(
      relationships.map(({ moduleName, moduleVersion, stackName, stackVersion }) => [
        moduleName,
        moduleVersion,
        stackName,
        stackVersion,
      ]),
    ).toEqual([
      ['s3bucket', '3.0.0', 'webstack', '1.2'],
      ['s3bucket', '2.8.0', 'webstack', '2.0.0'],
      ['s3bucket', '2.8.0', 'webstack', '1.2'],
      ['vpc', '1.0.0', 'webstack', '1.2'],
    ]);
  });

  it('sorts versions newest first by semver precedence, with a release above its prereleases', () => {
    const relationships = groupModuleStackUses([
      use({ module_version: '1.2.3-beta' }),
      use({ module_version: '1.2.3' }),
      use({ module_version: '1.10.0' }),
      use({ module_version: '1.9.0' }),
    ]);

    expect(relationships.map(({ moduleVersion }) => moduleVersion)).toEqual([
      '1.10.0',
      '1.9.0',
      '1.2.3',
      '1.2.3-beta',
    ]);
  });
});
