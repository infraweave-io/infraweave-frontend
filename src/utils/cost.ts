import { AccountCosts, CostGranularity, DeploymentCost } from '../types/Cost';

export const OTHER_LABEL = 'Other';

/** A group's dimension values, e.g. `Amazon S3` or `Amazon S3 · us-west-2`. */
export const costGroupLabel = (keys: string[]) => keys.filter(Boolean).join(' · ') || '(none)';

const currency = (amount: number, unit: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: unit,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Not an ISO currency code.
    return `${amount.toFixed(2)} ${unit}`;
  }
};

/** Two decimals, except that a few hundredths of a cent still reads as more than nothing. */
export const formatCost = (amount: number, unit = 'USD') =>
  amount > 0 && amount < 0.005 ? `< ${currency(0.01, unit)}` : currency(amount, unit);

/** Short axis ticks: `$600`, `$1.2K`, `$0.25`. */
export const formatCostTick = (amount: number, unit = 'USD') => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: unit,
      notation: 'compact',
      // Set explicitly: currency defaults to a minimum of two decimals, and ICU versions differ
      // on whether a lower maximum overrides it ($600 here, $600.0 in CI).
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.abs(amount) < 10 ? 2 : 1,
    }).format(amount);
  } catch {
    return `${amount} ${unit}`;
  }
};

/** In the viewer's locale; Cost Explorer periods are UTC, so they are labelled in UTC too. */
export const formatCostPeriod = (start: string, granularity: CostGranularity) => {
  const date = new Date(start.length === 10 ? `${start}T00:00:00Z` : start);
  if (Number.isNaN(date.getTime())) return start;
  switch (granularity) {
    case 'MONTHLY':
      return date.toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
    case 'DAILY':
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
    case 'HOURLY':
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      });
  }
};

/** The labels charted as their own series; the rest fold into "Other". */
export const topCostLabels = (cost: DeploymentCost, max: number) =>
  cost.groups.map((g) => costGroupLabel(g.keys)).slice(0, max);

/**
 * Colour slots for `labels`, keeping the slot each label had in `previous` so a
 * series keeps its colour when the range or granularity changes. Returns the
 * slots to use now and the memory to pass next time.
 */
export const assignSeriesSlots = (labels: string[], previous: ReadonlyMap<string, number>) => {
  const assigned = new Map<string, number>();
  const taken = new Set<number>();
  for (const label of labels) {
    const slot = previous.get(label);
    if (slot !== undefined && slot < labels.length && !taken.has(slot)) {
      assigned.set(label, slot);
      taken.add(slot);
    }
  }
  for (const label of labels) {
    if (assigned.has(label)) continue;
    let slot = 0;
    while (taken.has(slot)) slot++;
    assigned.set(label, slot);
    taken.add(slot);
  }
  const remembered = new Map(previous);
  assigned.forEach((slot, label) => remembered.set(label, slot));
  return { assigned, remembered };
};

export interface CostChartSeries {
  key: string;
  label: string;
}

export interface CostChart {
  rows: Array<Record<string, string | number>>;
  series: CostChartSeries[];
}

/** One row per period with an amount per series, for a stacked bar chart. */
export const buildCostChart = (cost: DeploymentCost, labels: string[]): CostChart => {
  const ungrouped = cost.group_by.length === 0;
  const series: CostChartSeries[] = ungrouped
    ? [{ key: 'total', label: 'Total' }]
    : labels.map((label, i) => ({ key: `s${i}`, label }));
  let hasOther = false;

  const rows = cost.periods.map((period) => {
    const row: Record<string, string | number> = {
      period: formatCostPeriod(period.start, cost.granularity),
    };
    series.forEach(({ key }) => (row[key] = 0));
    if (ungrouped) {
      row.total = period.total;
      return row;
    }
    row.other = 0;
    for (const group of period.groups) {
      const index = labels.indexOf(costGroupLabel(group.keys));
      const key = index >= 0 ? `s${index}` : 'other';
      if (key === 'other' && group.amount !== 0) hasOther = true;
      row[key] = (row[key] as number) + group.amount;
    }
    return row;
  });

  if (hasOther) series.push({ key: 'other', label: OTHER_LABEL });
  return { rows, series };
};

export const COST_RANGES: Record<CostGranularity, { periods: number; label: string }[]> = {
  MONTHLY: [
    { periods: 3, label: 'Last 3 months' },
    { periods: 6, label: 'Last 6 months' },
    { periods: 12, label: 'Last 12 months' },
  ],
  DAILY: [
    { periods: 7, label: 'Last 7 days' },
    { periods: 14, label: 'Last 14 days' },
    { periods: 30, label: 'Last 30 days' },
    { periods: 90, label: 'Last 90 days' },
  ],
  // Cost Explorer keeps hourly data for 14 days.
  HOURLY: [
    { periods: 24, label: 'Last 24 hours' },
    { periods: 48, label: 'Last 48 hours' },
    { periods: 7 * 24, label: 'Last 7 days' },
    { periods: 14 * 24, label: 'Last 14 days' },
  ],
};

export const DEFAULT_COST_PERIODS: Record<CostGranularity, number> = {
  MONTHLY: 6,
  DAILY: 30,
  HOURLY: 24,
};

/** Cost Explorer dimensions a cost can be broken down by. */
export const COST_DIMENSIONS = [
  { value: 'SERVICE', label: 'Service' },
  { value: 'USAGE_TYPE', label: 'Usage type' },
  { value: 'OPERATION', label: 'Operation' },
  { value: 'REGION', label: 'Region' },
  { value: 'AZ', label: 'Availability zone' },
  { value: 'INSTANCE_TYPE', label: 'Instance type' },
  { value: 'PURCHASE_TYPE', label: 'Purchase type' },
  { value: 'RECORD_TYPE', label: 'Charge type' },
];

export const COST_TAG = 'INFRAWEAVE_DEPLOYMENT_ID';

/** A query string from the set values only; lists are comma-separated. */
export const costQueryString = (params: Record<string, string | number | string[] | undefined>) => {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    const text = Array.isArray(value) ? value.filter(Boolean).join(',') : value;
    if (text !== undefined && text !== '') search.set(name, String(text));
  }
  return search.toString();
};

/**
 * Room for a comma-separated list in a query string. CloudFront and API Gateway refuse URLs past
 * about 8KB, and the other parameters (services, tag filters) need their share of that.
 */
export const MAX_QUERY_LIST_CHARS = 4000;

/**
 * `values` split into lists that each stay within `maxCount` values and, joined with commas and
 * URL-encoded, within `maxChars`. Deployment ids are long enough that a count alone is no limit
 * on the URL.
 */
export const chunkForQuery = (
  values: string[],
  maxCount: number,
  maxChars = MAX_QUERY_LIST_CHARS,
): string[][] => {
  const chunks: string[][] = [];
  let current: string[] = [];
  let length = 0;
  for (const value of values) {
    // Each value after the first also costs an encoded comma.
    const cost = encodeURIComponent(value).length + (current.length > 0 ? 3 : 0);
    if (current.length > 0 && (current.length >= maxCount || length + cost > maxChars)) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    current.push(value);
    length += encodeURIComponent(value).length + (current.length > 1 ? 3 : 0);
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
};

/** Breakdowns worked out here from per-deployment costs, rather than asked of Cost Explorer. */
export const DEPLOYMENT_BREAKDOWNS = [
  { value: 'account', label: 'Account' },
  { value: 'deployment', label: 'Deployment' },
  { value: 'module', label: 'Module' },
  { value: 'environment', label: 'Environment' },
];

/** Breakdowns by a cost allocation tag are `tag:<key>`, as the API takes them. */
export const TAG_BREAKDOWN_PREFIX = 'tag:';

export const tagBreakdown = (key: string) => `${TAG_BREAKDOWN_PREFIX}${key}`;

/** The tag key of a `tag:<key>` breakdown, or undefined for any other. */
export const breakdownTagKey = (breakdown: string) =>
  breakdown.startsWith(TAG_BREAKDOWN_PREFIX)
    ? breakdown.slice(TAG_BREAKDOWN_PREFIX.length)
    : undefined;

/** The label of a group whose tag or dimension value is empty. */
export const emptyGroupLabel = (breakdown: string) => {
  const tagKey = breakdownTagKey(breakdown);
  return tagKey ? `No ${tagKey} tag` : '(none)';
};

export const isDimensionBreakdown = (breakdown: string) =>
  !DEPLOYMENT_BREAKDOWNS.some((b) => b.value === breakdown);

export interface DeploymentInfo {
  module?: string;
  environment?: string;
}

export interface CostDescriber {
  projectName: (projectId: string) => string;
  /** What is known of a deployment. Absent for one that is gone but still had cost. */
  deployment: (projectId: string, deploymentId: string) => DeploymentInfo | undefined;
}

export interface CostRow {
  key: string;
  label: string;
  amount: number;
  /** Set for a single account, or a single deployment in one. */
  projectId?: string;
  deploymentId?: string;
}

export interface AggregatedCosts {
  total: number;
  unit: string;
  estimated: boolean;
  /** Largest first. */
  rows: CostRow[];
  /** Oldest first. */
  periods: { start: string; amounts: Map<string, number> }[];
  /** Deployments with any cost. */
  deploymentCount: number;
}

/** The costs of several accounts as one set of rows, by `breakdown`. */
export const aggregateAccountCosts = (
  results: { projectId: string; costs: AccountCosts }[],
  breakdown: string,
  describe: CostDescriber,
): AggregatedCosts => {
  const rows = new Map<string, CostRow>();
  const periods = new Map<string, Map<string, number>>();
  const deployments = new Set<string>();
  let total = 0;
  let estimated = false;
  let unit = 'USD';

  const rowFor = (projectId: string, deploymentId: string): CostRow => {
    switch (breakdown) {
      case 'account':
        return { key: projectId, label: describe.projectName(projectId), amount: 0, projectId };
      case 'module': {
        const module =
          describe.deployment(projectId, deploymentId)?.module || deploymentId.split('/')[0];
        return { key: module, label: module, amount: 0 };
      }
      case 'environment': {
        const environment =
          describe.deployment(projectId, deploymentId)?.environment || 'Unknown environment';
        return { key: environment, label: environment, amount: 0 };
      }
      default:
        return {
          key: `${projectId}|${deploymentId}`,
          label: deploymentId,
          amount: 0,
          projectId,
          deploymentId,
        };
    }
  };

  const add = (row: CostRow, amount: number, period?: string) => {
    const existing = rows.get(row.key) ?? row;
    existing.amount += amount;
    rows.set(row.key, existing);
    if (period !== undefined) {
      const amounts = periods.get(period) ?? new Map<string, number>();
      amounts.set(row.key, (amounts.get(row.key) ?? 0) + amount);
      periods.set(period, amounts);
    }
  };

  for (const { projectId, costs } of results) {
    unit = costs.unit || unit;
    estimated ||= costs.estimated;
    total += costs.total;
    for (const d of costs.deployments) {
      if (d.amount !== 0) deployments.add(`${projectId}|${d.deployment_id}`);
    }

    if (isDimensionBreakdown(breakdown)) {
      for (const g of costs.groups ?? [])
        add({ key: g.key, label: g.key || emptyGroupLabel(breakdown), amount: 0 }, g.amount);
      for (const p of costs.periods) {
        if (!periods.has(p.start)) periods.set(p.start, new Map());
        for (const g of p.groups ?? []) {
          const amounts = periods.get(p.start)!;
          amounts.set(g.key, (amounts.get(g.key) ?? 0) + g.amount);
        }
      }
    } else {
      for (const d of costs.deployments) add(rowFor(projectId, d.deployment_id), d.amount);
      for (const p of costs.periods) {
        if (!periods.has(p.start)) periods.set(p.start, new Map());
        for (const d of p.deployments) {
          const key = rowFor(projectId, d.deployment_id).key;
          const amounts = periods.get(p.start)!;
          amounts.set(key, (amounts.get(key) ?? 0) + d.amount);
        }
      }
    }
  }

  return {
    total,
    unit,
    estimated,
    rows: [...rows.values()].sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label)),
    periods: [...periods]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([start, amounts]) => ({ start, amounts })),
    deploymentCount: deployments.size,
  };
};

/** One row per period with an amount per charted key, the rest summed into "Other". */
export const buildBreakdownChart = (
  costs: AggregatedCosts,
  keys: { key: string; label: string }[],
  granularity: CostGranularity,
): CostChart => {
  const series: CostChartSeries[] = keys.map(({ label }, i) => ({ key: `s${i}`, label }));
  let hasOther = false;
  const rows = costs.periods.map(({ start, amounts }) => {
    const row: Record<string, string | number> = { period: formatCostPeriod(start, granularity) };
    series.forEach(({ key }) => (row[key] = 0));
    row.other = 0;
    amounts.forEach((amount, key) => {
      const index = keys.findIndex((k) => k.key === key);
      const column = index >= 0 ? `s${index}` : 'other';
      if (column === 'other' && amount !== 0) hasOther = true;
      row[column] = (row[column] as number) + amount;
    });
    return row;
  });
  if (hasOther) series.push({ key: 'other', label: OTHER_LABEL });
  return { rows, series };
};
