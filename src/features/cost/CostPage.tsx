import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  ListSubheader,
  MenuItem,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { PageHeading } from '../../shared/components/PageHeading';
import { useConfig } from '../../hooks/useConfig';
import { useAsync } from '../../hooks/useAsync';
import { useChartCategoricalColors } from '../../contexts/ThemeContext';
import { Deployment } from '../../types/Deployment';
import {
  fetchDeploymentHistory,
  HistorySource,
  MAX_HISTORY_DEPLOYMENT_IDS,
} from '../../utils/deploymentFetch';
import { AccountCosts, CostGranularity, CostTagKeys, ResourceCosts } from '../../types/Cost';
import {
  COST_DIMENSIONS,
  COST_RANGES,
  COST_TAG,
  CostRow,
  DEFAULT_COST_PERIODS,
  DEPLOYMENT_BREAKDOWNS,
  OTHER_LABEL,
  aggregateAccountCosts,
  breakdownTagKey,
  assignSeriesSlots,
  buildBreakdownChart,
  chunkForQuery,
  costQueryString,
  formatCost,
  formatCostTick,
  isDimensionBreakdown,
  tagBreakdown,
} from '../../utils/cost';
import { FleetGate } from '../adoption-health/AdoptionHealthPage/FleetStatus';
import { useSelectedProjects } from '../root/RootPage/SelectedProjectsContext';
import { Metric } from '../adoption-health/AdoptionHealthPage/OverviewParts';
import {
  FleetDeployments,
  useFleetDeployments,
} from '../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { CostShareTable, CostTableRow, ResourceIdLabel } from './CostTables';
import { AddTagFilter, TagFilterChips, TagFilterMap } from './TagFilters';
import { CostMetric, CostMetricToggle, DEFAULT_COST_METRIC } from './CostMetricToggle';

const BREAKDOWN_LABELS: Record<string, string> = Object.fromEntries(
  [...DEPLOYMENT_BREAKDOWNS, ...COST_DIMENSIONS].map((b) => [b.value, b.label]),
);

const breakdownLabelOf = (breakdown: string) => {
  const tagKey = breakdownTagKey(breakdown);
  if (tagKey === undefined) return BREAKDOWN_LABELS[breakdown] ?? breakdown;
  return `${tagKey} tag`;
};

/** The tag InfraWeave puts the environment in, used for the environment filter when it can be. */
const ENVIRONMENT_TAG = 'INFRAWEAVE_ENVIRONMENT';

/** Resource costs are read for the most expensive deployments of each account, at most this many. */
const RESOURCE_DEPLOYMENTS_PER_ACCOUNT = 50;

/** How many of the most expensive deployments missing from the fleet are looked up. */
const RESOLVED_UNKNOWN_DEPLOYMENTS = 50;

/** The most deployment ids the cost routes take in one request. */
const MAX_COST_FILTER_IDS = 200;

const RANKED_ROWS = 10;

const deploymentKey = (projectId: string, deploymentId: string) => `${projectId}|${deploymentId}`;

const deploymentLink = (d: Deployment) =>
  `/infraweave/deployment/${d.project_id}/${d.region}/${encodeURIComponent(
    d.environment ?? '',
  )}/${encodeURIComponent(d.deployment_id ?? '')}/overview`;

const unique = (values: (string | undefined)[]) =>
  [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

type AccountResult = { projectId: string; costs?: AccountCosts; error?: string };

type LoadProgress = { done: number; total: number };

/** How far a load across accounts has come: Cost Explorer answers each account separately. */
const LoadProgressBar = ({ progress }: { progress: LoadProgress }) => (
  <Box>
    <LinearProgress
      variant="determinate"
      value={(progress.done / progress.total) * 100}
      aria-label="Accounts loaded"
    />
    <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
      Reading cost from Cost Explorer: {progress.done} of {progress.total}{' '}
      {progress.total === 1 ? 'account' : 'accounts'}
    </Typography>
  </Box>
);

/** A deployment with cost, as the live fleet or the destroy history has it. */
type FoundDeployment = { deployment: Deployment; deleted: boolean };

/** Where the lookup of deployments missing from the fleet in the destroy history stands. */
type HistoryState = 'pending' | 'complete' | 'incomplete' | 'not-looked-up';

/**
 * Why a deployment is not live: destroyed, or not recorded by InfraWeave at all (its id is on
 * resources it does not know, or it is in a region not set up for the account). Nothing for a
 * live one, nor when the history could not be read in full.
 */
const deploymentStatus = (found: FoundDeployment | undefined, history: HistoryState) => {
  if (found) return found.deleted ? 'deleted' : undefined;
  if (history === 'not-looked-up') return undefined;
  if (history === 'pending') return 'looking up…';
  return history === 'complete' ? 'not known to InfraWeave' : undefined;
};

const deploymentDetail = (
  account: string,
  found: FoundDeployment | undefined,
  history: HistoryState,
) =>
  [account, found?.deployment.environment, deploymentStatus(found, history)]
    .filter(Boolean)
    .join(' · ');

export const CostPage = () => {
  const fleet = useFleetDeployments();
  return (
    <Box>
      <PageHeading
        title="Cost"
        description={`Only resources deployed through InfraWeave are counted, by the ${COST_TAG} tag it sets on them. New costs take several hours, up to a day, to show up.`}
      />
      <FleetGate fleet={fleet}>
        <CostExplorer fleet={fleet} />
      </FleetGate>
    </Box>
  );
};

const CostExplorer = ({ fleet }: { fleet: FleetDeployments }) => {
  const config = useConfig();
  const theme = useTheme();
  const colors = useChartCategoricalColors();

  // The accounts are the ones selected on the Deployments page, not every account the user can
  // see: each one costs a billed Cost Explorer query, and with many accounts "all" is a lot of
  // them. Changing them here changes that shared selection, so both pages stay in step.
  const { projects, selectedProjectNames, toggleProjectSelection } = useSelectedProjects();
  const [granularity, setGranularity] = useState<CostGranularity>('DAILY');
  const [periods, setPeriods] = useState(DEFAULT_COST_PERIODS.DAILY);
  const [breakdown, setBreakdown] = useState('SERVICE');
  const [metric, setMetric] = useState<CostMetric>(DEFAULT_COST_METRIC);
  const [services, setServices] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [environments, setEnvironments] = useState<string[]>([]);
  const [tagFilters, setTagFilters] = useState<TagFilterMap>({});
  const slotMemory = useRef<ReadonlyMap<string, number>>(new Map());
  const seenServices = useRef<Set<string>>(new Set());

  const allAccounts = useMemo(
    () =>
      Object.keys(fleet.projectRegions)
        .filter((id) => (fleet.projectRegions[id] ?? []).length > 0)
        .sort((a, b) => projectName(fleet, a).localeCompare(projectName(fleet, b))),
    [fleet],
  );
  const queriedAccounts = useMemo(
    () =>
      projects
        .filter((p) => selectedProjectNames.includes(p.name))
        .map((p) => p.project_id)
        .filter((id) => allAccounts.includes(id)),
    [projects, selectedProjectNames, allAccounts],
  );
  const setAccounts = (next: string[]) => {
    const nameOf = (id: string) => projects.find((p) => p.project_id === id)?.name;
    const wanted = new Set(next.map(nameOf).filter((n): n is string => !!n));
    const current = new Set(queriedAccounts.map(nameOf).filter((n): n is string => !!n));
    [...wanted].filter((n) => !current.has(n)).forEach(toggleProjectSelection);
    [...current].filter((n) => !wanted.has(n)).forEach(toggleProjectSelection);
  };

  const deploymentsByKey = useMemo(() => {
    const index = new Map<string, Deployment>();
    for (const d of fleet.deployments) {
      const key = deploymentKey(d.project_id, d.deployment_id);
      if (!index.has(key)) index.set(key, d);
    }
    return index;
  }, [fleet.deployments]);

  const moduleOptions = useMemo(() => unique(fleet.deployments.map((d) => d.module)), [fleet]);
  const environmentOptions = useMemo(
    () => unique(fleet.deployments.map((d) => d.environment)),
    [fleet],
  );
  const regionOptions = useMemo(() => unique([...fleet.regions, 'global']), [fleet.regions]);

  // The tag keys Cost Explorer has cost for in the accounts, as it offers them to group by.
  const tagKeyPaths = queriedAccounts.flatMap((projectId) => {
    const region = fleet.projectRegions[projectId]?.[0];
    return region ? [`cost_tags/${projectId}/${region}`] : [];
  });
  const { value: tagKeys, loading: tagKeysLoading } = useAsync(async (): Promise<string[]> => {
    const found = await Promise.all(
      tagKeyPaths.map(async (path) => {
        try {
          const response = await config.fetch(
            config.getApiUrl(`api/proxy/api/infraweave/api/v1/${path}`),
          );
          if (!response.ok) return [];
          return ((await response.json()) as CostTagKeys).tag_keys;
        } catch {
          return [];
        }
      }),
    );
    return [...new Set(found.flat())].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  }, [config, tagKeyPaths.join('\n')]);

  // Modules go to the API as such: it matches them against the deployment id, which keeps the
  // deployments destroyed since. Environments are not in the id, so they are matched on the
  // INFRAWEAVE_ENVIRONMENT tag when Cost Explorer has it, which keeps those too; otherwise only
  // the live deployments of the environments can be listed by id.
  const environmentsByTag = environments.length > 0 && !!tagKeys?.includes(ENVIRONMENT_TAG);
  const environmentsByLiveIds = environments.length > 0 && !environmentsByTag;

  /** The live deployment ids an environment filter narrows an account to, when it needs them. */
  const deploymentIdsFor = (projectId: string): string[] | undefined => {
    if (!environmentsByLiveIds) return undefined;
    return unique(
      fleet.deployments
        .filter(
          (d) =>
            d.project_id === projectId &&
            (modules.length === 0 || modules.includes(d.module)) &&
            (environments.length === 0 || environments.includes(d.environment)),
        )
        .map((d) => d.deployment_id),
    );
  };

  const groupBy = isDimensionBreakdown(breakdown) ? breakdown : undefined;
  const effectiveTagFilters: TagFilterMap = environmentsByTag
    ? {
        ...tagFilters,
        // A tag filter on the same key narrows it further: both must hold.
        [ENVIRONMENT_TAG]: tagFilters[ENVIRONMENT_TAG]
          ? tagFilters[ENVIRONMENT_TAG].filter((e) => environments.includes(e))
          : environments,
      }
    : tagFilters;
  const tagFiltersParam =
    Object.keys(effectiveTagFilters).length > 0 ? JSON.stringify(effectiveTagFilters) : undefined;
  /**
   * One account's queries with the page's filters: none when they rule the account out, and more
   * than one when a module or environment filter leaves more deployment ids than fit in a URL.
   * The parts filter on different deployments, so their costs add up.
   */
  const accountPaths = (projectId: string, options: Record<string, string | undefined>) => {
    const region = fleet.projectRegions[projectId]?.[0];
    const deploymentIds = deploymentIdsFor(projectId);
    // A filter that matches nothing in the account: nothing to ask Cost Explorer for.
    if (!region || (deploymentIds && deploymentIds.length === 0)) return [];
    const idChunks = deploymentIds
      ? chunkForQuery(deploymentIds, MAX_COST_FILTER_IDS)
      : [undefined];
    return idChunks.map((ids) => {
      const query = costQueryString({
        granularity,
        periods,
        metric,
        services,
        regions,
        deployment_ids: ids,
        modules,
        tag_filters: tagFiltersParam,
        ...options,
      });
      return `costs/${projectId}/${region}?${query}`;
    });
  };
  const requests = queriedAccounts.flatMap((projectId) =>
    accountPaths(projectId, { group_by: groupBy }).map((path) => ({ projectId, path })),
  );
  const requestedAccounts = unique(requests.map((r) => r.projectId));

  /** The values a tag has on the deployment costs the filters leave, across the accounts. */
  const loadTagValues = async (key: string) => {
    const paths = requestedAccounts.flatMap((projectId) =>
      accountPaths(projectId, { group_by: tagBreakdown(key), series: 'false' }),
    );
    // An account that fails only loses its own values, as with the costs themselves.
    const found = await Promise.all(
      paths.map(async (path) => {
        try {
          const response = await config.fetch(
            config.getApiUrl(`api/proxy/api/infraweave/api/v1/${path}`),
          );
          if (!response.ok) return [];
          const json = (await response.json()) as AccountCosts;
          return (json.groups ?? []).map((g) => g.key).filter(Boolean);
        } catch {
          return [];
        }
      }),
    );
    return unique(found.flat());
  };
  const requestsKey = requests.map((r) => r.path).join('\n');

  // Accounts answered so far in the running load, for its progress bar. An account can take
  // several requests (one per part of a long filter), and counts once all of them are in.
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const loadRun = useRef(0);
  const { value: loadedResult, loading } = useAsync(async (): Promise<{
    /** The requests the answer is for, and what they were asked for. */
    key: string;
    breakdown: string;
    granularity: CostGranularity;
    periods: number;
    accounts: AccountResult[];
  }> => {
    const key = requestsKey;
    const asked = { breakdown, granularity, periods };
    const run = ++loadRun.current;
    const pending = new Map<string, number>();
    requests.forEach(({ projectId }) => pending.set(projectId, (pending.get(projectId) ?? 0) + 1));
    const total = pending.size;
    let done = 0;
    setProgress({ done, total });
    const settled = (projectId: string) => {
      const left = (pending.get(projectId) ?? 1) - 1;
      pending.set(projectId, left);
      if (left === 0) done++;
      // A newer load has its own bar; this one must not move it.
      if (left === 0 && run === loadRun.current) setProgress({ done, total });
    };

    const accounts = await Promise.all(
      requests.map(async ({ projectId, path }): Promise<AccountResult> => {
        try {
          const response = await config.fetch(
            config.getApiUrl(`api/proxy/api/infraweave/api/v1/${path}`),
          );
          const json = await response.json().catch(() => undefined);
          if (!response.ok) throw new Error(json?.error ?? `Request failed: ${response.status}`);
          return { projectId, costs: json as AccountCosts };
        } catch (err) {
          return { projectId, error: (err as Error).message };
        } finally {
          settled(projectId);
        }
      }),
    );
    return { key, ...asked, accounts };
  }, [config, requestsKey]);
  const results = loadedResult?.accounts;
  // While a new answer loads the last one stays up, and it is drawn as what it was asked for:
  // its groups are regions until the services arrive, whatever the selector says by then. A
  // breakdown worked out here from the same answer (account, module, ...) applies at once.
  const answerIsCurrent = !loadedResult || loadedResult.key === requestsKey;
  const shownBreakdown = answerIsCurrent ? breakdown : loadedResult.breakdown;
  const shownGranularity = answerIsCurrent ? granularity : loadedResult.granularity;
  const shownPeriods = answerIsCurrent ? periods : loadedResult.periods;
  const showProgress = loading && progress !== null && progress.total > 0;

  const loaded = useMemo(
    () =>
      (results ?? []).flatMap((r) => (r.costs ? [{ projectId: r.projectId, costs: r.costs }] : [])),
    [results],
  );
  const failed = (results ?? []).filter((r) => r.error);

  // The fleet only holds live deployments, but destroyed ones still have cost from while they
  // ran. The deployments with cost the fleet does not know are looked up in the destroy history,
  // by id, in every region of their account.
  // The most expensive deployments missing from the fleet. Only they are looked up: the tables
  // lead with them, and each lookup reads an account's whole destroy history.
  const candidates = useMemo(() => {
    const totals = new Map<string, number>();
    for (const { projectId, costs } of loaded) {
      for (const d of costs.deployments) {
        const key = deploymentKey(projectId, d.deployment_id);
        if (deploymentsByKey.has(key)) continue;
        totals.set(key, (totals.get(key) ?? 0) + d.amount);
      }
    }
    return new Set(
      [...totals]
        .sort((a, b) => b[1] - a[1])
        .slice(0, RESOLVED_UNKNOWN_DEPLOYMENTS)
        .map(([key]) => key),
    );
  }, [loaded, deploymentsByKey]);

  // What the history said, kept for as long as the page is open: whether a deployment was
  // destroyed does not depend on the range or filters, so changing them asks only about
  // deployments not asked about yet. `null` is "not in the history" (read to the end); a key in
  // `unreadable` is one whose lookup could not finish.
  const [resolved, setResolved] = useState<ReadonlyMap<string, Deployment | null>>(new Map());
  const [unreadable, setUnreadable] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    const asked = [...candidates].filter(
      (key) => !resolved.has(key) && !unreadable.has(key) && !inFlight.current.has(key),
    );
    if (asked.length === 0) return;
    asked.forEach((key) => inFlight.current.add(key));

    const byProject = new Map<string, string[]>();
    for (const key of asked) {
      const [projectId, ...rest] = key.split('|');
      byProject.set(projectId, [...(byProject.get(projectId) ?? []), rest.join('|')]);
    }
    const sources: HistorySource[] = [...byProject].flatMap(([projectId, ids]) =>
      (fleet.projectRegions[projectId] ?? []).flatMap((region) =>
        chunkForQuery(ids, MAX_HISTORY_DEPLOYMENT_IDS).map((deploymentIds) => ({
          projectId,
          region,
          deploymentIds,
        })),
      ),
    );

    // Not cancelled when the filters move on: what it finds stays true, so it is kept.
    (async () => {
      let records: Deployment[] = [];
      let complete = false;
      try {
        const result = await fetchDeploymentHistory(config, 'deleted', sources);
        records = result.records;
        complete = !result.incomplete;
      } catch {
        // Treated as unreadable below.
      }
      setResolved((prev) => {
        const next = new Map(prev);
        for (const d of records) {
          const key = deploymentKey(d.project_id, d.deployment_id);
          const known = next.get(key);
          // The same id can have been deployed and destroyed several times: keep the last.
          if (!known || (known.epoch ?? 0) < (d.epoch ?? 0)) next.set(key, d);
        }
        // Only a lookup read to the end in every region can say a deployment is not there.
        if (complete) asked.forEach((key) => next.has(key) || next.set(key, null));
        return next;
      });
      if (!complete) {
        const found = new Set(records.map((d) => deploymentKey(d.project_id, d.deployment_id)));
        setUnreadable((prev) => new Set([...prev, ...asked.filter((key) => !found.has(key))]));
      }
      asked.forEach((key) => inFlight.current.delete(key));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, candidates, resolved, unreadable]);

  const historyFor = (projectId: string, deploymentId: string): HistoryState => {
    const key = deploymentKey(projectId, deploymentId);
    if (resolved.has(key)) return 'complete';
    if (unreadable.has(key)) return 'incomplete';
    return candidates.has(key) ? 'pending' : 'not-looked-up';
  };

  const deletedByKey = useMemo(() => {
    const index = new Map<string, Deployment>();
    resolved.forEach((d, key) => d && index.set(key, d));
    return index;
  }, [resolved]);

  const lookup = useMemo(
    () =>
      (projectId: string, deploymentId: string): FoundDeployment | undefined => {
        const key = deploymentKey(projectId, deploymentId);
        const live = deploymentsByKey.get(key);
        if (live) return { deployment: live, deleted: false };
        const gone = deletedByKey.get(key);
        return gone ? { deployment: gone, deleted: true } : undefined;
      },
    [deploymentsByKey, deletedByKey],
  );

  const describe = useMemo(
    () => ({
      projectName: (id: string) => projectName(fleet, id),
      deployment: (projectId: string, deploymentId: string) =>
        lookup(projectId, deploymentId)?.deployment,
    }),
    [fleet, lookup],
  );

  const aggregated = useMemo(
    () => aggregateAccountCosts(loaded, shownBreakdown, describe),
    [loaded, shownBreakdown, describe],
  );
  const byDeployment = useMemo(
    () => aggregateAccountCosts(loaded, 'deployment', describe),
    [loaded, describe],
  );

  // Only from answers grouped by service: any other answer's groups are regions, tags, ...
  for (const { costs } of loaded) {
    if (costs.group_by === 'SERVICE') {
      (costs.groups ?? []).forEach((g) => g.key && seenServices.current.add(g.key));
    }
  }
  const serviceOptions = unique([...seenServices.current, ...services]);

  const view = useMemo(() => {
    const top = aggregated.rows.slice(0, colors.series.length);
    const labels = top.map((r) => r.key);
    const { assigned, remembered } = assignSeriesSlots(labels, slotMemory.current);
    slotMemory.current = remembered;
    const ordered = [...top].sort((a, b) => assigned.get(a.key)! - assigned.get(b.key)!);
    const chart = buildBreakdownChart(aggregated, ordered, shownGranularity);
    const colorOfKey = (key: string) =>
      assigned.has(key) ? colors.series[assigned.get(key)!] : colors.other;
    const colorOfLabel = (label: string) => {
      if (label === OTHER_LABEL) return colors.other;
      const row = ordered.find((r) => r.label === label);
      return row ? colorOfKey(row.key) : colors.other;
    };
    return { chart, colorOfKey, colorOfLabel };
  }, [aggregated, colors, shownGranularity]);

  const rowFor = (row: CostRow, color?: string): CostTableRow => {
    const found = row.deploymentId ? lookup(row.projectId!, row.deploymentId) : undefined;
    return {
      key: row.key,
      label: row.label,
      detail: row.deploymentId
        ? deploymentDetail(
            projectName(fleet, row.projectId!),
            found,
            historyFor(row.projectId!, row.deploymentId),
          )
        : undefined,
      amount: row.amount,
      color,
      link: found ? deploymentLink(found.deployment) : undefined,
      deleted: found?.deleted,
    };
  };

  const handleGranularity = (_: unknown, next: CostGranularity | null) => {
    if (!next) return;
    setGranularity(next);
    setPeriods(DEFAULT_COST_PERIODS[next]);
  };

  const rangeLabel =
    COST_RANGES[shownGranularity].find((r) => r.periods === shownPeriods)?.label ?? '';
  const breakdownLabel = breakdownLabelOf(shownBreakdown);
  const breakdownTag = breakdownTagKey(shownBreakdown);
  const tagNotOnCosts =
    breakdownTag !== undefined &&
    aggregated.rows.length > 0 &&
    aggregated.rows.every((r) => r.key === '');
  // The chosen tag stays listed while the keys load, so the select can show it.
  const tagBreakdownKeys = [
    ...new Set([...(tagKeys ?? []), ...(breakdownTag ? [breakdownTag] : [])]),
  ];
  const unit = aggregated.unit;
  const accountsWithCost = new Set(
    loaded.filter((r) => r.costs.total !== 0).map((r) => r.projectId),
  );
  const filtersSet =
    services.length +
      regions.length +
      modules.length +
      environments.length +
      Object.keys(tagFilters).length >
    0;

  return (
    <Grid container spacing={2.5}>
      <Grid size={12}>
        <Card>
          <CardContent>
            <Box display="flex" flexWrap="wrap" gap={1.5} alignItems="center">
              <ToggleButtonGroup
                size="small"
                exclusive
                value={granularity}
                onChange={handleGranularity}
                aria-label="Granularity"
              >
                <ToggleButton value="MONTHLY">Monthly</ToggleButton>
                <ToggleButton value="DAILY">Daily</ToggleButton>
                <ToggleButton value="HOURLY">Hourly</ToggleButton>
              </ToggleButtonGroup>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="cost-page-range">Range</InputLabel>
                <Select
                  labelId="cost-page-range"
                  label="Range"
                  value={periods}
                  onChange={(e) => setPeriods(Number(e.target.value))}
                >
                  {COST_RANGES[granularity].map((r) => (
                    <MenuItem key={r.periods} value={r.periods}>
                      {r.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel id="cost-page-breakdown">Break down by</InputLabel>
                <Select
                  labelId="cost-page-breakdown"
                  label="Break down by"
                  value={breakdown}
                  onChange={(e) => setBreakdown(String(e.target.value))}
                >
                  <ListSubheader>InfraWeave</ListSubheader>
                  {DEPLOYMENT_BREAKDOWNS.map((b) => (
                    <MenuItem key={b.value} value={b.value}>
                      {b.label}
                    </MenuItem>
                  ))}
                  <ListSubheader>AWS</ListSubheader>
                  {COST_DIMENSIONS.map((b) => (
                    <MenuItem key={b.value} value={b.value}>
                      {b.label}
                    </MenuItem>
                  ))}
                  <ListSubheader>Tags</ListSubheader>
                  {tagBreakdownKeys.map((key) => (
                    <MenuItem key={key} value={tagBreakdown(key)}>
                      {key}
                    </MenuItem>
                  ))}
                  {tagBreakdownKeys.length === 0 && (
                    <MenuItem disabled>
                      {tagKeysLoading ? 'Loading tags…' : 'No tags with cost'}
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
              <CostMetricToggle value={metric} onChange={setMetric} />
            </Box>
            {showProgress && results && (
              <Box mt={1.5}>
                <LoadProgressBar progress={progress} />
              </Box>
            )}

            <Box display="flex" flexWrap="wrap" gap={1.5} mt={1.5}>
              <MultiFilter
                label="Accounts"
                placeholder="Select accounts"
                options={allAccounts}
                value={queriedAccounts}
                onChange={setAccounts}
                optionLabel={(id) => projectName(fleet, id)}
              />
              <MultiFilter
                label="Services"
                placeholder="All services"
                options={serviceOptions}
                value={services}
                onChange={setServices}
                freeSolo
              />
              <MultiFilter
                label="Regions"
                placeholder="All regions"
                options={regionOptions}
                value={regions}
                onChange={setRegions}
              />
              <MultiFilter
                label="Modules"
                placeholder="All modules"
                options={moduleOptions}
                value={modules}
                onChange={setModules}
              />
              <MultiFilter
                label="Environments"
                placeholder="All environments"
                options={environmentOptions}
                value={environments}
                onChange={setEnvironments}
              />
            </Box>
            {environmentsByLiveIds && !tagKeysLoading && (
              <Typography variant="caption" color="text.secondary" component="div" mt={1}>
                The environment filter only covers deployments that still exist: destroyed ones are
                counted once {ENVIRONMENT_TAG} is activated as a cost allocation tag.
              </Typography>
            )}

            <Box display="flex" flexWrap="wrap" gap={1} mt={1.5} alignItems="center">
              <TagFilterChips
                filters={tagFilters}
                onRemove={(key) => setTagFilters(({ [key]: _removed, ...rest }) => rest)}
              />
              <AddTagFilter
                tagKeys={tagKeys ?? []}
                loadingKeys={tagKeysLoading}
                loadValues={loadTagValues}
                onAdd={(key, values) => setTagFilters((prev) => ({ ...prev, [key]: values }))}
              />
              {filtersSet && (
                <Button
                  size="small"
                  onClick={() => {
                    setServices([]);
                    setRegions([]);
                    setModules([]);
                    setEnvironments([]);
                    setTagFilters({});
                  }}
                >
                  Clear filters
                </Button>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {tagNotOnCosts && (
        <Grid size={12}>
          <Alert severity="info">
            None of this cost carries the {breakdownTag} tag. A tag only shows up here once it is
            activated as a cost allocation tag in the billing account, and only for costs from after
            that.
          </Alert>
        </Grid>
      )}

      {failed.length > 0 && (
        <Grid size={12}>
          <Alert severity="warning">
            Cost could not be read for{' '}
            {unique(failed.map((f) => projectName(fleet, f.projectId))).join(', ')}:{' '}
            {failed[0].error}
          </Alert>
        </Grid>
      )}

      {!results ? (
        <Grid size={12}>
          <Box display="flex" justifyContent="center" py={6}>
            {showProgress ? (
              <Box sx={{ width: '100%', maxWidth: 420 }}>
                <LoadProgressBar progress={progress} />
              </Box>
            ) : (
              <CircularProgress size={28} />
            )}
          </Box>
        </Grid>
      ) : queriedAccounts.length === 0 ? (
        <Grid size={12}>
          <Alert severity="info">
            Select the accounts to show cost for. These are the accounts selected on the Deployments
            page.
          </Alert>
        </Grid>
      ) : requests.length === 0 ? (
        <Grid size={12}>
          <Alert severity="info">No deployments match the filters.</Alert>
        </Grid>
      ) : (
        <>
          <Grid size={{ xs: 6, md: 3 }}>
            <Metric
              label={`Total · ${rangeLabel.toLowerCase()}`}
              value={formatCost(aggregated.total, unit)}
              hint={
                aggregated.estimated
                  ? 'Includes periods Cost Explorer has not finalized'
                  : undefined
              }
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Metric
              label="Accounts with cost"
              value={`${accountsWithCost.size} of ${requestedAccounts.length}`}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Metric label="Deployments with cost" value={aggregated.deploymentCount} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Metric
              label={`Largest ${breakdownLabel.toLowerCase()}`}
              value={aggregated.rows[0] ? formatCost(aggregated.rows[0].amount, unit) : '–'}
              hint={aggregated.rows[0]?.label}
            />
          </Grid>

          <Grid size={12}>
            <Card>
              <CardHeader
                title={`Cost over time by ${breakdownLabel.toLowerCase()}`}
                subheader={aggregated.rows[0] ? `Largest: ${aggregated.rows[0].label}` : undefined}
              />
              <CardContent>
                {aggregated.total === 0 ? (
                  <Alert severity="info">
                    No cost recorded in the selected range. Costs only show up once {COST_TAG} is
                    activated as a cost allocation tag in the billing account.
                  </Alert>
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: 320,
                      '& .MuiBarElement-root': {
                        stroke: theme.palette.background.paper,
                        strokeWidth: 2,
                      },
                    }}
                  >
                    <BarChart
                      dataset={view.chart.rows}
                      xAxis={[{ scaleType: 'band', dataKey: 'period', tickLabelInterval: 'auto' }]}
                      yAxis={[
                        {
                          width: 56,
                          valueFormatter: (v: number | null) => formatCostTick(v ?? 0, unit),
                        },
                      ]}
                      series={view.chart.series.map((s) => ({
                        dataKey: s.key,
                        label: s.label,
                        stack: 'cost',
                        color: view.colorOfLabel(s.label),
                        valueFormatter: (v: number | null) => formatCost(v ?? 0, unit),
                      }))}
                      hideLegend={view.chart.series.length < 2}
                      borderRadius={4}
                      grid={{ horizontal: true }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardHeader
                title={`Top ${breakdownLabel.toLowerCase()}`}
                subheader={`The ${Math.min(RANKED_ROWS, aggregated.rows.length)} largest of ${
                  aggregated.rows.length
                }`}
              />
              <CardContent>
                <RankingChart
                  rows={aggregated.rows.slice(0, RANKED_ROWS)}
                  unit={unit}
                  colorOf={view.colorOfKey}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardHeader title={`All by ${breakdownLabel.toLowerCase()}`} />
              <CardContent>
                <CostShareTable
                  heading={breakdownLabel}
                  ariaLabel={`Cost by ${breakdownLabel}`}
                  total={aggregated.total}
                  unit={unit}
                  maxHeight={360}
                  rows={aggregated.rows.map((row) => rowFor(row, view.colorOfKey(row.key)))}
                />
              </CardContent>
            </Card>
          </Grid>

          {shownBreakdown !== 'deployment' && (
            <Grid size={{ xs: 12, lg: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardHeader
                  title="Most expensive deployments"
                  subheader={`${rangeLabel}${filtersSet ? ', with the filters above' : ''}`}
                />
                <CardContent>
                  <CostShareTable
                    heading="Deployment"
                    ariaLabel="Most expensive deployments"
                    total={byDeployment.total}
                    unit={unit}
                    maxHeight={360}
                    rows={byDeployment.rows.slice(0, 25).map((row) => rowFor(row))}
                  />
                </CardContent>
              </Card>
            </Grid>
          )}

          <Grid size={{ xs: 12, lg: shownBreakdown !== 'deployment' ? 6 : 12 }}>
            <ResourceCostsCard
              fleet={fleet}
              loaded={loaded}
              services={services}
              regions={regions}
              tagFilters={tagFiltersParam}
              metric={metric}
              lookup={lookup}
              historyFor={historyFor}
            />
          </Grid>
        </>
      )}
    </Grid>
  );
};

const projectName = (fleet: FleetDeployments, id: string) => fleet.projectNames[id] || id;

const MultiFilter = ({
  label,
  placeholder,
  options,
  value,
  onChange,
  optionLabel = (o) => o,
  freeSolo = false,
}: {
  label: string;
  placeholder: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  optionLabel?: (option: string) => string;
  freeSolo?: boolean;
}) => (
  <Autocomplete
    multiple
    size="small"
    freeSolo={freeSolo}
    options={options}
    value={value}
    onChange={(_, next) => onChange(next.map(String).filter((v) => v.trim() !== ''))}
    getOptionLabel={(o) => optionLabel(String(o))}
    renderTags={(selected, getTagProps) =>
      selected.map((option, index) => (
        <Chip
          {...getTagProps({ index })}
          key={String(option)}
          size="small"
          label={optionLabel(String(option))}
        />
      ))
    }
    renderInput={(params) => (
      <TextField
        {...params}
        label={label}
        placeholder={value.length === 0 ? placeholder : undefined}
      />
    )}
    sx={{ minWidth: 200, flex: '1 1 200px', maxWidth: 360 }}
  />
);

/**
 * Largest first, each bar in the colour its row has in the chart and table above (grey past the
 * charted ones), so the same thing reads as the same colour everywhere on the page.
 */
const RankingChart = ({
  rows,
  unit,
  colorOf,
}: {
  rows: CostRow[];
  unit: string;
  colorOf: (key: string) => string;
}) => {
  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nothing to rank.
      </Typography>
    );
  }
  // Keyed by row key, not label: one deployment id can be in several accounts.
  const labelOf = new Map(rows.map((r) => [r.key, r.label]));
  const shorten = (label: string) => (label.length > 28 ? `${label.slice(0, 27)}…` : label);
  return (
    <Box sx={{ width: '100%', height: 36 * rows.length + 40 }}>
      <BarChart
        layout="horizontal"
        dataset={rows.map((r) => ({ key: r.key, amount: r.amount }))}
        yAxis={[
          {
            scaleType: 'band',
            dataKey: 'key',
            width: 190,
            valueFormatter: (key: string, context) => {
              const label = labelOf.get(key) ?? key;
              return context.location === 'tooltip' ? label : shorten(label);
            },
            colorMap: {
              type: 'ordinal',
              values: rows.map((r) => r.key),
              colors: rows.map((r) => colorOf(r.key)),
            },
          },
        ]}
        xAxis={[{ valueFormatter: (v: number | null) => formatCostTick(v ?? 0, unit) }]}
        series={[
          {
            dataKey: 'amount',
            label: 'Cost',
            valueFormatter: (v: number | null) => formatCost(v ?? 0, unit),
          },
        ]}
        hideLegend
        borderRadius={4}
        grid={{ vertical: true }}
      />
    </Box>
  );
};

/**
 * Resource costs, on request: they need resource-level data enabled in Cost Explorer, cover the
 * last 14 days only, and are read for the most expensive deployments of each account.
 */
const ResourceCostsCard = ({
  fleet,
  loaded,
  services,
  regions,
  tagFilters,
  metric,
  lookup,
  historyFor,
}: {
  fleet: FleetDeployments;
  loaded: { projectId: string; costs: AccountCosts }[];
  services: string[];
  regions: string[];
  /** As the `tag_filters` parameter, if any. */
  tagFilters?: string;
  metric: CostMetric;
  lookup: (projectId: string, deploymentId: string) => FoundDeployment | undefined;
  historyFor: (projectId: string, deploymentId: string) => HistoryState;
}) => {
  const config = useConfig();
  // The requests of the last Load. Each one is a billed Cost Explorer query, so a change of the
  // filters only offers to reload rather than asking again by itself.
  const [shown, setShown] = useState<{ projectId: string; path: string }[] | null>(null);
  const requested = shown !== null;

  // The most expensive deployments of each account, whichever parts of it they came back in.
  const topByAccount = new Map<string, { deployment_id: string; amount: number }[]>();
  for (const { projectId, costs } of loaded) {
    topByAccount.set(projectId, [...(topByAccount.get(projectId) ?? []), ...costs.deployments]);
  }
  const requests = [...topByAccount].flatMap(([projectId, deployments]) => {
    const region = fleet.projectRegions[projectId]?.[0];
    const deploymentIds = deployments
      .filter((d) => d.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, RESOURCE_DEPLOYMENTS_PER_ACCOUNT)
      .map((d) => d.deployment_id)
      // In a fixed order, so the same deployments are the same request, which the API and the
      // browser can then answer from their caches.
      .sort();
    if (!region || deploymentIds.length === 0) return [];
    return chunkForQuery(deploymentIds, RESOURCE_DEPLOYMENTS_PER_ACCOUNT).map((ids) => ({
      projectId,
      path: `cost_resources/${projectId}/${region}?${costQueryString({
        days: 14,
        metric,
        services,
        regions,
        deployment_ids: ids,
        tag_filters: tagFilters,
      })}`,
    }));
  });
  const requestsKey = requests.map((r) => r.path).join('\n');
  const shownKey = shown?.map((r) => r.path).join('\n');
  const outdated = requested && shownKey !== requestsKey;

  const { value, loading } = useAsync(async () => {
    if (!shown) return undefined;
    return Promise.all(
      shown.map(async ({ projectId, path }) => {
        try {
          const response = await config.fetch(
            config.getApiUrl(`api/proxy/api/infraweave/api/v1/${path}`),
          );
          const json = await response.json().catch(() => undefined);
          if (!response.ok) throw new Error(json?.error ?? `Request failed: ${response.status}`);
          return { projectId, costs: json as ResourceCosts };
        } catch (err) {
          return { projectId, error: (err as Error).message };
        }
      }),
    );
  }, [config, shownKey]);

  const resources = (value ?? [])
    .flatMap((r) =>
      'costs' in r && r.costs
        ? r.costs.resources.map((res) => ({ ...res, projectId: r.projectId, unit: r.costs!.unit }))
        : [],
    )
    .sort((a, b) => b.amount - a.amount);
  const total = resources.reduce((sum, r) => sum + r.amount, 0);
  const errors = (value ?? []).filter((r) => 'error' in r && r.error) as {
    projectId: string;
    error: string;
  }[];

  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title="Most expensive resources"
        subheader="Last 14 days, for the most expensive deployments of each account"
        action={
          (!requested || outdated) && (
            <Button size="small" variant="outlined" onClick={() => setShown(requests)}>
              {requested ? 'Reload' : 'Load'}
            </Button>
          )
        }
      />
      <CardContent>
        {!requested ? (
          <Typography variant="body2" color="text.secondary">
            Resource costs come from Cost Explorer&apos;s resource-level data, which has to be
            enabled in its settings in the management account.
          </Typography>
        ) : loading && !value ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            {outdated && (
              <Typography variant="caption" color="text.secondary" component="div" mb={1.5}>
                The filters have changed since these were loaded.
              </Typography>
            )}
            {errors.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {errors[0].error}
                {errors.length > 1 && ` (and ${errors.length - 1} more accounts)`}
              </Alert>
            )}
            {resources.length === 0 ? (
              errors.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No resource costs in the last 14 days.
                </Typography>
              )
            ) : (
              <CostShareTable
                heading="Resource"
                ariaLabel="Most expensive resources"
                total={total}
                unit={resources[0].unit}
                maxHeight={360}
                rows={resources.slice(0, 50).map((r) => {
                  const found = lookup(r.projectId, r.deployment_id);
                  return {
                    key: `${r.projectId}|${r.deployment_id}|${r.resource_id}`,
                    label: <ResourceIdLabel resourceId={r.resource_id} />,
                    detail: [
                      r.deployment_id,
                      projectName(fleet, r.projectId),
                      deploymentStatus(found, historyFor(r.projectId, r.deployment_id)),
                    ]
                      .filter(Boolean)
                      .join(' · '),
                    amount: r.amount,
                    link: found ? deploymentLink(found.deployment) : undefined,
                    deleted: found?.deleted,
                  };
                })}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
