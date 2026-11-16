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

/** Most deployments first. Configured groups get a row even when nothing runs in them. */
export const summarizeGroups = (
  deployments: Deployment[],
  groupOf: GroupOf,
  configured: string[],
  isStack: (d: Deployment) => boolean,
): GroupRow[] => {
  const groups = new Map<
    string,
    {
      count: number;
      failing: number;
      accounts: Set<string>;
      regions: Set<string>;
      modules: Set<string>;
      stacks: Set<string>;
    }
  >();
  const groupFor = (key: string) => {
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

  for (const key of configured) groupFor(key);
  for (const d of deployments) {
    const key = groupOf(d);
    if (!key) continue;
    const group = groupFor(key);
    group.count += 1;
    if (d.project_id) group.accounts.add(d.project_id);
    if (d.region) group.regions.add(d.region);
    if (d.module) (isStack(d) ? group.stacks : group.modules).add(d.module);
    if (isFailedDeployment(d)) group.failing += 1;
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
  const entries = new Map<
    string,
    EntryRow & { accountIds: Set<string>; regionIds: Set<string>; versionIds: Set<string> }
  >();
  const breakdown = new Map<string, BreakdownRow & { entryKeys: Set<string> }>();
  const statuses = new Map<string, number>();
  const accounts = new Set<string>();
  const regions = new Set<string>();
  let failing = 0;
  let drifted = 0;

  const breakdownFor = (key: string) => {
    let row = breakdown.get(key);
    if (!row) {
      row = { key, count: 0, entries: 0, failing: 0, lastActivity: 0, entryKeys: new Set() };
      breakdown.set(key, row);
    }
    return row;
  };
  for (const key of configuredBreakdown) breakdownFor(key);

  for (const d of deployments) {
    const failed = isFailedDeployment(d);
    if (failed) failing += 1;
    if (d.has_drifted === true) drifted += 1;
    if (d.project_id) accounts.add(d.project_id);
    if (d.region) regions.add(d.region);

    const status = d.status || 'unknown';
    statuses.set(status, (statuses.get(status) ?? 0) + 1);

    // A module and a stack can share a name, so the kind is part of the key.
    const kind = isStack(d) ? 'stack' : 'module';
    const entryKey = `${kind}:${d.module}`;
    if (d.module) {
      const entry = entries.get(entryKey) ?? {
        name: d.module,
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
      if (d.project_id) entry.accountIds.add(d.project_id);
      if (d.region) entry.regionIds.add(d.region);
      if (d.module_version) entry.versionIds.add(d.module_version);
      if (failed) entry.failing += 1;
      entries.set(entryKey, entry);
    }

    const row = breakdownFor(breakdownOf(d) ?? 'unknown');
    row.count += 1;
    if (d.module) row.entryKeys.add(entryKey);
    if (failed) row.failing += 1;
    row.lastActivity = Math.max(row.lastActivity, d.epoch ?? 0);
  }

  const entryRows = Array.from(entries.values())
    .map(({ accountIds, regionIds, versionIds, ...row }) => ({
      ...row,
      accounts: accountIds.size,
      regions: regionIds.size,
      versions: versionIds.size,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    total: deployments.length,
    accounts: accounts.size,
    regions: regions.size,
    modules: entryRows.filter((row) => row.kind === 'module').length,
    stacks: entryRows.filter((row) => row.kind === 'stack').length,
    failing,
    drifted,
    statuses: Array.from(statuses.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    entryRows,
    breakdownRows: Array.from(breakdown.values())
      .map(({ entryKeys, ...row }) => ({ ...row, entries: entryKeys.size }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
  };
};
