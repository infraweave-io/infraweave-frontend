import React from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { StatusChip } from '../../../shared/components/StatusChip';
import { ListIncomplete } from '../../../shared/components/ListIncomplete';
import { useConfig } from '../../../hooks/useConfig';
import { useProjects } from '../../../hooks/useProjects';
import { Deployment } from '../../../types/Deployment';
import { useFleetDeployments } from '../../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { statusTone } from '../../adoption-health/AdoptionHealthPage/OverviewParts';
import { jobDrawerSearch } from '../../deployments/detail/jobDrawer';
import {
  fetchDeploymentHistory,
  HistorySource,
  HistoryType,
  INCOMPLETE_REASON_TEXT,
} from '../../../utils/deploymentFetch';
import { isFailedDeployment, statusKind } from '../../../utils/deploymentStatus';
import { deploymentKey, deploymentLink } from '../../../utils/deploymentLink';
import { useCachedQuery } from '../../../utils/queryCache';
import { ago, formatDateTime } from '../../../utils/format';
import { FleetGate } from '../FleetGate';
import { useWidgetSetting } from '../widgetSettings';
import { useOnWidgetReload } from '../widgetReload';

/** A widget is a preview; the full lists live on the Deployments tab. */
const MAX_ROWS = 10;

type StatusFilter = 'all' | 'success' | 'failed' | 'running';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'success', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'running', label: 'In progress' },
];

/** Error text counts as failed whatever the status, as everywhere else. */
const matchesStatus = (d: Deployment, filter: StatusFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'failed') return isFailedDeployment(d);
  return !isFailedDeployment(d) && statusKind(d.status) === filter;
};

type ModuleOption = { name: string; kind: 'Modules' | 'Stacks' };

type ActivityListProps = {
  /** Plural noun for counts and the empty state, e.g. `plans`. */
  noun: string;
  records: Deployment[];
  /** Epoch ms of the load behind `records`, said in the empty state. */
  fetchedAt: number;
  projectNames: Record<string, string>;
  /** Where a row's name leads. */
  linkFor: (d: Deployment) => string;
};

/**
 * Newest first, narrowed by the modules and stacks the user picked and by status. Both
 * filters are kept per widget, so each copy of the list can watch different modules.
 */
const ActivityList = ({ noun, records, fetchedAt, projectNames, linkFor }: ActivityListProps) => {
  const [picked, setPicked] = useWidgetSetting<string[]>('modules', []);
  const [storedStatus, setStatus] = useWidgetSetting<StatusFilter>('status', 'all');
  const status = STATUS_OPTIONS.some((option) => option.value === storedStatus)
    ? storedStatus
    : 'all';

  const sorted = React.useMemo(() => [...records].sort((a, b) => b.epoch - a.epoch), [records]);

  // Only modules something happened to, so no option leads to an empty list. A picked module
  // with nothing left is kept as an option so it can still be removed.
  const options = React.useMemo(() => {
    const byName = new Map<string, ModuleOption>();
    for (const d of sorted) {
      if (d.module && !byName.has(d.module)) {
        byName.set(d.module, {
          name: d.module,
          kind: d.module_type === 'stack' ? 'Stacks' : 'Modules',
        });
      }
    }
    for (const name of picked) {
      if (!byName.has(name)) byName.set(name, { name, kind: 'Modules' });
    }
    return Array.from(byName.values()).sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
    );
  }, [sorted, picked]);

  const selected = options.filter((option) => picked.includes(option.name));
  const filtering = picked.length > 0 || status !== 'all';

  const matches = React.useMemo(() => {
    const names = new Set(picked);
    return sorted.filter(
      (d) => (names.size === 0 || names.has(d.module)) && matchesStatus(d, status),
    );
  }, [sorted, picked, status]);

  const clearFilters = () => {
    setPicked([]);
    setStatus('all');
  };

  if (records.length === 0) {
    // Only as fresh as the last check, so say when that was.
    return (
      <Typography variant="body2" color="text.secondary">
        No {noun} yet. Checked {ago(fetchedAt)}.
      </Typography>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        <Autocomplete
          multiple
          size="small"
          limitTags={1}
          options={options}
          groupBy={(option) => option.kind}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.name === value.name}
          value={selected}
          onChange={(_, next) => setPicked(next.map((option) => option.name))}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Modules & stacks"
              placeholder={selected.length === 0 ? 'All' : undefined}
            />
          )}
          sx={{ flex: '2 1 180px', minWidth: 0 }}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          sx={{ flex: '1 1 120px' }}
        >
          {STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Mounted with the filters; a live region added with its text is often not read. */}
      <Typography
        role="status"
        variant="caption"
        color="text.secondary"
        component="div"
        sx={{ minHeight: '1.5em' }}
      >
        {filtering &&
          (matches.length > MAX_ROWS
            ? `Showing ${MAX_ROWS} of ${matches.length} matching ${noun}`
            : `${matches.length} matching ${noun}`)}
      </Typography>

      {matches.length === 0 ? (
        <Box sx={{ py: 1 }}>
          <Typography variant="body2" color="text.secondary">
            No {noun} match these filters.
          </Typography>
          <Button size="small" onClick={clearFilters} sx={{ mt: 0.5, ml: -0.5 }}>
            Clear filters
          </Button>
        </Box>
      ) : (
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {matches.slice(0, MAX_ROWS).map((d) => (
            <Box
              key={`${deploymentKey(d)}/${d.job_id}`}
              sx={{ py: 1, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}
            >
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                  <Link to={linkFor(d)}>{d.deployment_id}</Link>
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {d.module} · {projectNames[d.project_id] ?? d.project_id} · {d.region} ·{' '}
                  {d.environment}
                </Typography>
              </Box>
              <StatusChip
                tone={isFailedDeployment(d) ? 'error' : statusTone(d.status)}
                label={d.status || 'unknown'}
                title={d.error_text}
              />
              {d.epoch > 0 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  title={`${formatDateTime(d.epoch)}${
                    d.initiated_by ? ` by ${d.initiated_by}` : ''
                  }`}
                  sx={{ flexShrink: 0 }}
                >
                  {ago(d.epoch)}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

const RowsSkeleton = ({ label }: { label: string }) => (
  <Stack spacing={1} aria-busy="true" aria-label={label}>
    {[0, 1, 2].map((i) => (
      <Skeleton key={i} variant="rounded" height={44} />
    ))}
  </Stack>
);

/**
 * The latest change to each live deployment. Reads the shared fleet cache, so it adds no
 * fetching of its own. A plan that finds drift also stamps the deployment, so a drifted
 * deployment can show here with its drift check's time.
 */
export const LatestAppliesList = () => {
  const fleet = useFleetDeployments();
  return (
    <FleetGate fleet={fleet} skeleton={<RowsSkeleton label="Loading latest applies" />}>
      <ActivityList
        noun="applies"
        records={fleet.deployments}
        fetchedAt={fleet.fetchedAt}
        projectNames={fleet.projectNames}
        linkFor={deploymentLink}
      />
    </FleetGate>
  );
};

/** Every visible account in each of its regions, sorted so the cache key is stable. */
const useHistorySources = () => {
  const { projects, loading, error } = useProjects();
  const sources = React.useMemo(
    () =>
      projects
        .flatMap((p) => (p.regions || []).map((region) => ({ projectId: p.project_id, region })))
        .sort((a, b) => `${a.projectId}/${a.region}`.localeCompare(`${b.projectId}/${b.region}`)),
    [projects],
  );
  const projectNames = React.useMemo(
    () => Object.fromEntries(projects.map((p) => [p.project_id, p.name || p.project_id])),
    [projects],
  );
  return {
    sources,
    projectNames,
    accessKnown: !loading,
    // A failed refresh over a cached list is not worth blanking the widget for.
    error: projects.length === 0 ? error : undefined,
  };
};

const NO_SOURCES: HistorySource[] = [];

type HistoryListProps = Pick<ActivityListProps, 'noun' | 'linkFor'> & {
  type: HistoryType;
  /** Read by screen readers while loading, e.g. `Loading latest plans`. */
  loadingLabel: string;
};

/**
 * Plans and destroys are not in the fleet, only behind the per-account history route, so
 * this asks every account and region the user can see. Shared through the query cache, so
 * the result is reused for a few minutes.
 */
const HistoryList = ({ type, noun, loadingLabel, linkFor }: HistoryListProps) => {
  const config = useConfig();
  const access = useHistorySources();
  const sources = access.accessKnown ? access.sources : NO_SOURCES;
  const scope = sources.map((s) => `${s.projectId}/${s.region}`).join(',');

  const query = useCachedQuery(`deployment-history:${type}:${scope}`, () =>
    fetchDeploymentHistory(config, type, sources),
  );
  useOnWidgetReload(query.reload);

  if (access.error) {
    return <ResponseErrorPanel error={access.error} title="Could not load accounts" />;
  }
  if (access.accessKnown && sources.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        None of your accounts has a region configured, so there are no {noun} to show.
      </Typography>
    );
  }
  if (!access.accessKnown || query.loading) return <RowsSkeleton label={loadingLabel} />;
  if (!query.data) {
    return <ResponseErrorPanel error={query.error ?? new Error(`No ${noun} loaded.`)} />;
  }

  return (
    <Box>
      {query.error && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          The last refresh failed. Showing data from {ago(query.fetchedAt)}.
        </Alert>
      )}
      <ActivityList
        noun={noun}
        records={query.data.records}
        fetchedAt={query.fetchedAt}
        projectNames={access.projectNames}
        linkFor={linkFor}
      />
      {query.data.incomplete && (
        <ListIncomplete label={noun} reason={INCOMPLETE_REASON_TEXT[query.data.incomplete]} />
      )}
    </Box>
  );
};

/** Opens the plan's resource changes on the deployment's Events & Logs tab. */
const planLink = (d: Deployment): string =>
  d.job_id
    ? `${deploymentLink(d).replace(/\/overview$/, '/events')}${jobDrawerSearch(
        new URLSearchParams(),
        { jobId: d.job_id, view: 'changes', changeType: 'plan' },
      )}`
    : deploymentLink(d);

/** The most recent plan runs, drift checks included, across every visible account. */
export const LatestPlansList = () => (
  <HistoryList type="plans" noun="plans" loadingLabel="Loading latest plans" linkFor={planLink} />
);

/** The most recently destroyed deployments across every visible account. */
export const LatestDestroysList = () => (
  <HistoryList
    type="deleted"
    noun="destroys"
    loadingLabel="Loading latest destroys"
    linkFor={deploymentLink}
  />
);
