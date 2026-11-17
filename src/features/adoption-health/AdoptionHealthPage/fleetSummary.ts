import { Deployment } from '../../../types/Deployment';
import { isFailedDeployment } from '../../../utils/deploymentStatus';

/** Fleet rollups by region or account, computed from the cached fleet with no extra requests. */

/** Regions InfraWeave runs in. Any other region shows as its code only. */
const REGION_NAMES: Record<string, string> = {
  'us-east-1': 'N. Virginia',
  'us-east-2': 'Ohio',
  'us-west-1': 'N. California',
  'us-west-2': 'Oregon',
  'ca-central-1': 'Canada (Central)',
  'eu-west-1': 'Ireland',
  'eu-west-2': 'London',
  'eu-west-3': 'Paris',
  'eu-central-1': 'Frankfurt',
  'eu-north-1': 'Stockholm',
  'ap-south-1': 'Mumbai',
  'ap-southeast-1': 'Singapore',
  'ap-southeast-2': 'Sydney',
  'ap-northeast-1': 'Tokyo',
};

export const regionName = (region: string): string | undefined => REGION_NAMES[region];

export type GroupOf = (d: Deployment) => string | undefined;

export const byRegion: GroupOf = (d) => d.region || undefined;
export const byAccount: GroupOf = (d) => d.project_id || undefined;

export type GroupRow = {
  key: string;
  count: number;
  accounts: number;
  regions: number;
  modules: number;
  stacks: number;
  failing: number;
};

type GroupAccumulator = {
  count: number;
  failing: number;
  accounts: Set<string>;
  regions: Set<string>;
  modules: Set<string>;
  stacks: Set<string>;
};

const groupFor = (groups: Map<string, GroupAccumulator>, key: string) => {
  let group = groups.get(key);
  if (!group) {
    group = {
      count: 0,
      failing: 0,
      accounts: new Set(),
      regions: new Set(),
      modules: new Set(),
      stacks: new Set(),
    };
    groups.set(key, group);
  }
  return group;
};

const addGroupDeployment = (
  groups: Map<string, GroupAccumulator>,
  deployment: Deployment,
  groupOf: GroupOf,
  isStack: (d: Deployment) => boolean,
) => {
  const key = groupOf(deployment);
  if (!key) return;

  const group = groupFor(groups, key);
  group.count += 1;
  if (deployment.project_id) group.accounts.add(deployment.project_id);
  if (deployment.region) group.regions.add(deployment.region);
  if (deployment.module) {
    (isStack(deployment) ? group.stacks : group.modules).add(deployment.module);
  }
  if (isFailedDeployment(deployment)) group.failing += 1;
};

/** Most deployments first. Configured groups get a row even when nothing runs in them. */
export const summarizeGroups = (
  deployments: Deployment[],
  groupOf: GroupOf,
  configured: string[],
  isStack: (d: Deployment) => boolean,
): GroupRow[] => {
  const groups = new Map<string, GroupAccumulator>();
  for (const key of configured) groupFor(groups, key);
  for (const deployment of deployments) {
    addGroupDeployment(groups, deployment, groupOf, isStack);
  }

  return Array.from(groups.entries())
    .map(([key, group]) => ({
      key,
      count: group.count,
      accounts: group.accounts.size,
      regions: group.regions.size,
      modules: group.modules.size,
      stacks: group.stacks.size,
      failing: group.failing,
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
};

export type EntryRow = {
  name: string;
  kind: 'module' | 'stack';
  count: number;
  accounts: number;
  regions: number;
  versions: number;
  failing: number;
};

export type BreakdownRow = {
  key: string;
  count: number;
  /** Distinct modules and stacks. */
  entries: number;
  failing: number;
  lastActivity: number;
};

export type GroupSummary = {
  total: number;
  accounts: number;
  regions: number;
  modules: number;
  stacks: number;
  failing: number;
  drifted: number;
  statuses: { status: string; count: number }[];
  entryRows: EntryRow[];
  breakdownRows: BreakdownRow[];
};

type EntryAccumulator = EntryRow & {
  accountIds: Set<string>;
  regionIds: Set<string>;
  versionIds: Set<string>;
};

type BreakdownAccumulator = BreakdownRow & { entryKeys: Set<string> };

type GroupSummaryAccumulator = {
  entries: Map<string, EntryAccumulator>;
  breakdown: Map<string, BreakdownAccumulator>;
  statuses: Map<string, number>;
  accounts: Set<string>;
  regions: Set<string>;
  failing: number;
  drifted: number;
};

const breakdownFor = (rows: Map<string, BreakdownAccumulator>, key: string) => {
  let row = rows.get(key);
  if (!row) {
    row = { key, count: 0, entries: 0, failing: 0, lastActivity: 0, entryKeys: new Set() };
    rows.set(key, row);
  }
  return row;
};

const addGroupTotals = (
  summary: GroupSummaryAccumulator,
  deployment: Deployment,
  failed: boolean,
) => {
  if (failed) summary.failing += 1;
  if (deployment.has_drifted === true) summary.drifted += 1;
  if (deployment.project_id) summary.accounts.add(deployment.project_id);
  if (deployment.region) summary.regions.add(deployment.region);

  const status = deployment.status || 'unknown';
  summary.statuses.set(status, (summary.statuses.get(status) ?? 0) + 1);
};

const addEntryDeployment = (
  entries: Map<string, EntryAccumulator>,
  deployment: Deployment,
  kind: 'module' | 'stack',
  key: string,
  failed: boolean,
) => {
  if (!deployment.module) return;

  const entry = entries.get(key) ?? {
    name: deployment.module,
    kind,
    count: 0,
    accounts: 0,
    regions: 0,
    versions: 0,
    failing: 0,
    accountIds: new Set<string>(),
    regionIds: new Set<string>(),
    versionIds: new Set<string>(),
  };
  entry.count += 1;
  if (deployment.project_id) entry.accountIds.add(deployment.project_id);
  if (deployment.region) entry.regionIds.add(deployment.region);
  if (deployment.module_version) entry.versionIds.add(deployment.module_version);
  if (failed) entry.failing += 1;
  entries.set(key, entry);
};

const addBreakdownDeployment = (
  rows: Map<string, BreakdownAccumulator>,
  deployment: Deployment,
  breakdownOf: GroupOf,
  entryKey: string,
  failed: boolean,
) => {
  const row = breakdownFor(rows, breakdownOf(deployment) ?? 'unknown');
  row.count += 1;
  if (deployment.module) row.entryKeys.add(entryKey);
  if (failed) row.failing += 1;
  row.lastActivity = Math.max(row.lastActivity, deployment.epoch ?? 0);
};

/**
 * One group's deployments, split by `breakdownOf`. Values in `configuredBreakdown` get a
 * row even when nothing runs in them.
 */
export const summarizeGroup = (
  deployments: Deployment[],
  isStack: (d: Deployment) => boolean,
  breakdownOf: GroupOf,
  configuredBreakdown: string[] = [],
): GroupSummary => {
  const summary: GroupSummaryAccumulator = {
    entries: new Map(),
    breakdown: new Map(),
    statuses: new Map(),
    accounts: new Set(),
    regions: new Set(),
    failing: 0,
    drifted: 0,
  };

  for (const key of configuredBreakdown) breakdownFor(summary.breakdown, key);

  for (const deployment of deployments) {
    const failed = isFailedDeployment(deployment);
    addGroupTotals(summary, deployment, failed);

    // A module and a stack can share a name, so the kind is part of the key.
    const kind = isStack(deployment) ? 'stack' : 'module';
    const entryKey = `${kind}:${deployment.module}`;
    addEntryDeployment(summary.entries, deployment, kind, entryKey, failed);
    addBreakdownDeployment(summary.breakdown, deployment, breakdownOf, entryKey, failed);
  }

  const entryRows = Array.from(summary.entries.values())
    .map(({ accountIds, regionIds, versionIds, ...row }) => ({
      ...row,
      accounts: accountIds.size,
      regions: regionIds.size,
      versions: versionIds.size,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    total: deployments.length,
    accounts: summary.accounts.size,
    regions: summary.regions.size,
    modules: entryRows.filter((row) => row.kind === 'module').length,
    stacks: entryRows.filter((row) => row.kind === 'stack').length,
    failing: summary.failing,
    drifted: summary.drifted,
    statuses: Array.from(summary.statuses.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    entryRows,
    breakdownRows: Array.from(summary.breakdown.values())
      .map(({ entryKeys, ...row }) => ({ ...row, entries: entryKeys.size }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
  };
};
