import type { StackModuleUsage } from '../../../types/Deployment';
import { compareVersions } from '../../../utils/version';
import { deploymentKey } from './deploymentViewUtils';

export type ModuleStackRelationship = {
  moduleName: string;
  moduleTrack: string;
  moduleVersion: string;
  stackName: string;
  stackTrack: string;
  stackVersion: string;
  deployments: StackModuleUsage[];
};
/** Groups unique deployed stack uses by module version and parent stack version. */
export const groupModuleStackUses = (uses: StackModuleUsage[]): ModuleStackRelationship[] => {
  const groups = new Map<string, Map<string, StackModuleUsage>>();
  for (const use of uses) {
    const relationshipKey = JSON.stringify([
      use.module,
      use.module_track,
      use.module_version,
      use.stackName,
      use.stackTrack,
      use.stackVersion,
    ]);
    const deployments = groups.get(relationshipKey) ?? new Map<string, StackModuleUsage>();
    deployments.set(deploymentKey(use), use);
    groups.set(relationshipKey, deployments);
  }

  return Array.from(groups.values(), (deploymentsByKey) => {
    const deployments = Array.from(deploymentsByKey.values());
    const [first] = deployments;
    return {
      moduleName: first.module,
      moduleTrack: first.module_track,
      moduleVersion: first.module_version,
      stackName: first.stackName,
      stackTrack: first.stackTrack,
      stackVersion: first.stackVersion,
      deployments,
    };
  }).sort(
    (a, b) =>
      a.moduleName.localeCompare(b.moduleName) ||
      compareVersions(a.moduleVersion, b.moduleVersion, 'desc') ||
      a.stackName.localeCompare(b.stackName) ||
      compareVersions(a.stackVersion, b.stackVersion, 'desc'),
  );
};
