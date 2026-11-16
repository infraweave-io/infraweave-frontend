import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useConfig } from '../../../hooks/useConfig';
import {
  Progress,
  ResponseErrorPanel,
  InfoCard,
  Link,
} from '../../../standalone/components/ComponentAdapter';
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Link as MuiLink,
  Card,
  CardHeader,
  CardActionArea,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  alpha,
} from '@mui/material';
import ModuleIcon from '@mui/icons-material/Extension';
import StackIcon from '@mui/icons-material/Layers';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { PageHeading } from '../../../shared/components/PageHeading';
import { useChartStatusColors } from '../../../contexts/ThemeContext';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { Deployment } from '../../../types/Deployment';
import { Event } from '../../../types/Event';
import { isFailedDeployment, StatusKind, statusKind } from '../../../utils/deploymentStatus';
import { mapWithConcurrency } from '../../../utils/deploymentFetch';
import { DeploymentsDialog } from '../../modules/detail/ModuleVersions';
import { ModuleOverview } from './ModuleOverview';
import { isStackDeployment, moduleName, useFleetDeployments } from './useFleetDeployments';
import { scrollToSection } from './OverviewParts';
import { FleetGate } from './FleetStatus';
import { UsageRanking } from './UsageRanking';

/** Deployments per value of one field, as pie slices, largest first. */
const countBy = (
  deployments: Deployment[],
  key: (d: Deployment) => string,
  label: (value: string) => string = (value) => value,
) => {
  const counts = new Map<string, number>();
  for (const d of deployments) counts.set(key(d), (counts.get(key(d)) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([id, value]) => ({ id, value, label: label(id) }))
    .sort((a, b) => b.value - a.value);
};

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** A deployment id is only unique within its account, region and environment. */
const deploymentKey = (d: Deployment) =>
  `${d.project_id}/${d.region}/${d.environment}/${d.deployment_id}`;

const deploymentLink = (d: Deployment) =>
  `/infraweave/deployment/${d.project_id}/${d.region}/${encodeURIComponent(
    d.environment,
  )}/${encodeURIComponent(d.deployment_id)}/overview`;

type UsageKind = 'module' | 'stack';

const KIND_LABEL: Record<UsageKind, string> = { module: 'Module', stack: 'Stack' };

const UsageView = ({ kind, onBack }: { kind: UsageKind; onBack: () => void }) => {
  const fleet = useFleetDeployments();
  const { projectNames } = fleet;
  const label = KIND_LABEL[kind];
  const [selectedName, setSelectedName] = useState('');
  const overviewRef = React.useRef<HTMLDivElement>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  // Deployments Dialog State
  const [openDeployments, setOpenDeployments] = useState(false);
  const [selectedVersionForModal, setSelectedVersionForModal] = useState<string>('');

  const handleVersionClick = (version: string) => {
    setSelectedVersionForModal(version);
    setOpenDeployments(true);
  };

  const catalogue = kind === 'stack' ? fleet.stackCatalogue : fleet.moduleCatalogue;
  const registered = React.useMemo(() => catalogue.map(moduleName).filter(Boolean), [catalogue]);
  const stackNames = React.useMemo(
    () => new Set(fleet.stackCatalogue.map(moduleName)),
    [fleet.stackCatalogue],
  );
  const kindDeployments = React.useMemo(
    () => fleet.deployments.filter((d) => isStackDeployment(d, stackNames) === (kind === 'stack')),
    [fleet.deployments, stackNames, kind],
  );
  // Registry entries plus anything deployed under a name the registry no longer has.
  const options = React.useMemo(
    () =>
      Array.from(
        new Set([...registered, ...kindDeployments.map((d) => d.module).filter(Boolean)]),
      ).sort(),
    [registered, kindDeployments],
  );

  const rawDeployments = React.useMemo(
    () => (selectedName ? kindDeployments.filter((d) => d.module === selectedName) : []),
    [kindDeployments, selectedName],
  );
  const availableStatuses = React.useMemo(
    () =>
      Array.from(new Set(rawDeployments.map((d) => d.status)))
        .filter(Boolean)
        .sort(),
    [rawDeployments],
  );

  const selectFromRanking = (name: string) => {
    setSelectedName(name);
    scrollToSection(overviewRef);
  };

  // Reset filters on selection change
  useEffect(() => {
    setStatusFilter([]);
  }, [selectedName]);
  // Derived, so no render shows a status that the current selection does not have.
  const activeStatuses = React.useMemo(
    () => statusFilter.filter((status) => availableStatuses.includes(status)),
    [statusFilter, availableStatuses],
  );

  // Calculated during render, so the first paint already has them.
  const { filteredStats, chartRegions } = React.useMemo(() => {
    const filteredDeployments =
      activeStatuses.length > 0
        ? rawDeployments.filter((d) => activeStatuses.includes(d.status))
        : rawDeployments;

    // Aggregate by version and region
    const versionMap: Record<string, any> = {};
    const foundRegions = new Set<string>();

    filteredDeployments.forEach((d) => {
      const v = d.module_version || (d as any).version;
      const r = d.region;

      if (v && r) {
        foundRegions.add(r);
        if (!versionMap[v]) {
          versionMap[v] = { version: v };
        }
        versionMap[v][r] = (versionMap[v][r] || 0) + 1;
      }
    });

    const statsData = Object.values(versionMap).sort((a, b) => {
      const totalA = Object.keys(a).reduce(
        (sum, key) => (key !== 'version' ? sum + a[key] : sum),
        0,
      );
      const totalB = Object.keys(b).reduce(
        (sum, key) => (key !== 'version' ? sum + b[key] : sum),
        0,
      );
      return totalB - totalA;
    });

    return {
      filteredStats: statsData as Record<string, any>[],
      chartRegions: Array.from(foundRegions).sort(),
    };
  }, [rawDeployments, activeStatuses]);

  if (fleet.error) return <ResponseErrorPanel error={fleet.error} />;

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Box mb={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
            Back to Dashboard
          </Button>
        </Box>
        <FleetGate
          fleet={fleet}
          scope={{ deployments: kindDeployments, noun: `${kind} deployment` }}
        >
          <Card variant="outlined" sx={{ width: '100%', mb: 3 }}>
            <CardHeader
              title={`Most deployed ${kind}s`}
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            />
            <CardContent>
              <Typography variant="body1" paragraph>
                Every {kind} in the registry, by number of active deployments across all accounts.
                Select one to see where it runs and on which versions.
              </Typography>
              <UsageRanking
                kind={kind}
                deployments={kindDeployments}
                registered={registered}
                loading={fleet.loadingCatalog}
                selected={selectedName}
                onSelect={selectFromRanking}
              />
            </CardContent>
          </Card>

          <Card ref={overviewRef} variant="outlined" sx={{ width: '100%', mb: 3 }}>
            <CardHeader
              title={`${label} Fleet Overview`}
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            />
            <CardContent>
              <Typography variant="body1" paragraph>
                Pick a {kind} to see its deployments across all accounts and regions.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mb: selectedName ? 3 : 0 }}>
                <Autocomplete
                  options={options}
                  value={selectedName || null}
                  onChange={(_, newValue) => setSelectedName(newValue ?? '')}
                  renderInput={(params) => (
                    <TextField {...params} label={`Select ${label}`} variant="outlined" />
                  )}
                  sx={{ width: 300 }}
                />
              </Box>

              {selectedName && (
                <ModuleOverview
                  kind={kind}
                  deployments={rawDeployments}
                  projectNames={projectNames}
                  onVersionClick={handleVersionClick}
                />
              )}
            </CardContent>
          </Card>

          {selectedName && (
            <Card variant="outlined" sx={{ width: '100%' }}>
              <CardHeader
                title="Version Distribution by Region"
                titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                sx={{ borderBottom: 1, borderColor: 'divider' }}
              />
              <CardContent>
                {/* Status filter is card-local so the overview keeps showing failures. */}
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                  <Autocomplete
                    multiple
                    options={availableStatuses}
                    value={activeStatuses}
                    onChange={(_, newValue) => setStatusFilter(newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Filter Status"
                        variant="outlined"
                        placeholder="All Statuses"
                      />
                    )}
                    sx={{ width: 300 }}
                  />
                </Box>

                {filteredStats.length === 0 && (
                  <Typography color="text.secondary">
                    {rawDeployments.length === 0
                      ? `No active deployments found for this ${kind}.`
                      : 'No deployments match the selected statuses.'}
                  </Typography>
                )}

                {filteredStats.length > 0 && (
                  <>
                    <Box sx={{ width: '100%', mb: 2 }}>
                      <Typography variant="h6" gutterBottom align="center">
                        Active Deployments by Version
                      </Typography>
                      <BarChart
                        dataset={filteredStats}
                        xAxis={[{ scaleType: 'band', dataKey: 'version', label: 'Version' }]}
                        series={chartRegions.map((region) => ({
                          dataKey: region,
                          label: region,
                          stack: 'total',
                        }))}
                        slotProps={{
                          legend: {
                            position: { vertical: 'top', horizontal: 'center' },
                          },
                        }}
                        height={350}
                      />
                    </Box>

                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Version</TableCell>
                            {chartRegions.map((region) => (
                              <TableCell key={region} align="right">
                                {region}
                              </TableCell>
                            ))}
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              Total
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredStats.map((row) => {
                            const total = chartRegions.reduce(
                              (sum, region) => sum + (row[region] || 0),
                              0,
                            );
                            return (
                              <TableRow key={row.version}>
                                <TableCell component="th" scope="row">
                                  <MuiLink
                                    component="button"
                                    variant="body2"
                                    onClick={() => handleVersionClick(row.version)}
                                    underline="hover"
                                  >
                                    {row.version}
                                  </MuiLink>
                                </TableCell>
                                {chartRegions.map((region) => (
                                  <TableCell key={region} align="right">
                                    {row[region] || 0}
                                  </TableCell>
                                ))}
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                  {total}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Outside both cards: a version link in the overview opens it as well. */}
          {openDeployments && selectedName && (
            <DeploymentsDialog
              open={openDeployments}
              onClose={() => setOpenDeployments(false)}
              moduleName={selectedName}
              version={selectedVersionForModal}
              resourceType={kind}
            />
          )}
        </FleetGate>
      </Grid>
    </Grid>
  );
};

/** Max concurrent events requests, same limit as the fleet fetch. */
const MAX_CONCURRENT_EVENT_REQUESTS = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

const VelocityView = ({ onBack }: { onBack: () => void }) => {
  const config = useConfig();
  const fleet = useFleetDeployments();
  const chartColors = useChartStatusColors();
  // Null until the first load; a refresh keeps the chart up until its events arrive.
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [timeframe, setTimeframe] = useState(30);

  // Not keyed on the timeframe, which only changes how the same events are counted.
  useEffect(() => {
    // Events are fetched per deployment, so wait for the fleet.
    if (fleet.fetchedAt === 0 || !fleet.accessKnown) return undefined;

    // Keeps a superseded run from overwriting newer events if it finishes last.
    let cancelled = false;

    const fetchData = async () => {
      setError(null);
      try {
        const allDeployments = fleet.deployments;

        // A fleet can have thousands of deployments, so throttle and stop once superseded.
        const eventsResults = await mapWithConcurrency(
          allDeployments,
          MAX_CONCURRENT_EVENT_REQUESTS,
          (d): Promise<Event[]> => {
            if (cancelled) return Promise.resolve([]);
            const encEnv = encodeURIComponent(d.environment);
            const encId = encodeURIComponent(d.deployment_id);
            return config
              .fetch(
                config.getApiUrl(
                  `api/proxy/api/infraweave/api/v1/events/${d.project_id}/${d.region}/${encEnv}/${encId}`,
                ),
              )
              .then((r) => (r.ok ? r.json() : []))
              .then((json) => (Array.isArray(json) ? json : []) as Event[])
              .catch(() => [] as Event[]);
          },
        );
        if (!cancelled) setEvents(eventsResults.flat());
      } catch (err) {
        if (!cancelled) setError(err as Error);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [config, fleet.fetchedAt, fleet.accessKnown, fleet.deployments]);

  const stats = React.useMemo(() => {
    // Group by Date (YYYY-MM-DD)
    const grouped: Record<string, { success: number; failed: number }> = {};

    (events ?? []).forEach((e) => {
      if (!e.epoch) return;
      const date = new Date(e.epoch).toISOString().split('T')[0];

      if (!grouped[date]) {
        grouped[date] = { success: 0, failed: 0 };
      }

      const kind = statusKind(e.status);
      if (kind === 'success') grouped[date].success++;
      else if (kind === 'failed') grouped[date].failed++;
    });

    // Fill details for last N days. Stepped in UTC days, as the events are grouped, so a
    // daylight saving change neither skips nor repeats a day.
    const now = Date.now();
    const chartData = [];
    for (let i = timeframe - 1; i >= 0; i--) {
      const dateStr = new Date(now - i * DAY_MS).toISOString().split('T')[0];
      chartData.push({
        date: dateStr,
        success: grouped[dateStr]?.success || 0,
        failed: grouped[dateStr]?.failed || 0,
      });
    }
    return chartData;
  }, [events, timeframe]);

  if (fleet.error) return <ResponseErrorPanel error={fleet.error} />;
  if (error) return <ResponseErrorPanel error={error} />;
  // Until a fleet exists, the gate below shows its own loading screen.
  if (!events && fleet.fetchedAt > 0 && fleet.accessKnown) return <Progress />;

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Box mb={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
            Back to Dashboard
          </Button>
        </Box>
        <FleetGate fleet={fleet}>
          <InfoCard title="Operational Velocity">
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="body1">
                Deployment frequency and success rate over time across all projects.
              </Typography>
              <FormControl variant="outlined" size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="timeframe-select-label">Timeframe</InputLabel>
                <Select
                  labelId="timeframe-select-label"
                  value={timeframe}
                  onChange={(e) => setTimeframe(Number(e.target.value))}
                  label="Timeframe"
                >
                  <MenuItem value={7}>Last 7 Days</MenuItem>
                  <MenuItem value={14}>Last 14 Days</MenuItem>
                  <MenuItem value={30}>Last 30 Days</MenuItem>
                  <MenuItem value={60}>Last 60 Days</MenuItem>
                  <MenuItem value={90}>Last 90 Days</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ width: '100%', height: 400 }}>
              <LineChart
                dataset={stats}
                xAxis={[{ scaleType: 'point', dataKey: 'date', label: 'Date' }]}
                series={[
                  {
                    dataKey: 'success',
                    label: 'Successful Deployments',
                    color: chartColors.success,
                  },
                  { dataKey: 'failed', label: 'Failed Deployments', color: chartColors.failed },
                ]}
                height={350}
              />
            </Box>
          </InfoCard>
        </FleetGate>
      </Grid>
    </Grid>
  );
};

const DeploymentHealthView = ({ onBack }: { onBack: () => void }) => {
  const fleet = useFleetDeployments();
  const chartColors = useChartStatusColors();

  // chartColors is a per-mode constant, so this only reruns on a theme flip or fleet reload.
  const statusStats = React.useMemo(
    () =>
      countBy(fleet.deployments, (d) => d.status || 'unknown', capitalise).map((slice) => {
        const colorByKind: Record<StatusKind, string> = {
          success: chartColors.success,
          failed: chartColors.failed,
          'in-progress': chartColors.inProgress,
          unknown: chartColors.unknown,
        };
        return { ...slice, color: colorByKind[statusKind(slice.id)] };
      }),
    [fleet.deployments, chartColors],
  );

  const errorDeployments = React.useMemo(
    // Same rule as Module Issues, so the two views agree on how many are failing.
    () => fleet.deployments.filter(isFailedDeployment),
    [fleet.deployments],
  );

  if (fleet.error) return <ResponseErrorPanel error={fleet.error} />;

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Box mb={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
            Back to Dashboard
          </Button>
        </Box>
        <FleetGate fleet={fleet}>
          <Grid container spacing={3}>
            {/* Status Ratio */}
            <Grid size={{ xs: 12, md: 6 }}>
              <InfoCard title="Status Ratio">
                <Typography variant="body1" paragraph>
                  Overview of deployment statuses across all projects in the platform.
                </Typography>
                <Box sx={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center' }}>
                  <PieChart
                    series={[
                      {
                        data: statusStats,
                        innerRadius: 30,
                        outerRadius: 100,
                        paddingAngle: 5,
                        cornerRadius: 5,
                        highlightScope: { fade: 'global', highlight: 'item' },
                        faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
                      },
                    ]}
                    height={300}
                  />
                </Box>
              </InfoCard>
            </Grid>

            {/* Error Log */}
            <Grid size={12}>
              <InfoCard title={`Active Errors (${errorDeployments.length})`}>
                <Typography variant="body1" paragraph>
                  Detailed list of deployments currently active but in a failed state across all
                  projects.
                </Typography>
                {errorDeployments.length === 0 ? (
                  <Typography
                    variant="body1"
                    sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}
                  >
                    No deployments currently in failed state. Great job!
                  </Typography>
                ) : (
                  <TableContainer component={Paper} elevation={0}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Deployment ID</TableCell>
                          <TableCell>Environment</TableCell>
                          <TableCell>Region</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Error Info</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {errorDeployments.map((d) => (
                          <TableRow key={deploymentKey(d)}>
                            <TableCell sx={{ fontWeight: 'medium' }}>
                              <Link to={deploymentLink(d)}>{d.deployment_id}</Link>
                            </TableCell>
                            <TableCell>{d.environment}</TableCell>
                            <TableCell>{d.region}</TableCell>
                            <TableCell sx={{ color: 'error.main' }}>{d.status}</TableCell>
                            <TableCell>
                              <Typography variant="body2" color="error">
                                {d.error_text || 'Unknown failure reason'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </InfoCard>
            </Grid>
          </Grid>
        </FleetGate>
      </Grid>
    </Grid>
  );
};

/** A module or a stack: the two can share a name, so the kind is part of what it is. */
type IssueEntry = { name: string; kind: UsageKind };

const entryKey = (entry: IssueEntry) => `${entry.kind}:${entry.name}`;

const entryLabel = (entry: IssueEntry) =>
  entry.kind === 'stack' ? `${entry.name} (stack)` : entry.name;

const ModuleIssuesView = ({ onBack }: { onBack: () => void }) => {
  const fleet = useFleetDeployments();
  const { deployments: rawDeployments } = fleet;
  const chartColors = useChartStatusColors();
  const [selectedEntry, setSelectedEntry] = useState<IssueEntry | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const uniqueRegions = Array.from(new Set(rawDeployments.map((d) => d.region)))
    .filter(Boolean)
    .sort();
  const uniqueAccounts = Array.from(new Set(rawDeployments.map((d) => d.project_id)))
    .filter(Boolean)
    .sort();

  const activeErrorsRef = React.useRef<HTMLDivElement>(null);

  const stackNames = React.useMemo(
    () => new Set(fleet.stackCatalogue.map(moduleName)),
    [fleet.stackCatalogue],
  );
  const entryOf = React.useCallback(
    (d: Deployment): IssueEntry => ({
      name: d.module || 'unknown',
      kind: isStackDeployment(d, stackNames) ? 'stack' : 'module',
    }),
    [stackNames],
  );

  const handleEntryClick = (entry: IssueEntry) => {
    setSelectedEntry(entry);
    scrollToSection(activeErrorsRef);
  };
  // Both registries, plus a selection no longer in either, so the filter can show it.
  const entryOptions = React.useMemo(() => {
    const entries = new Map<string, IssueEntry>();
    const add = (entry: IssueEntry) => entries.set(entryKey(entry), entry);
    fleet.moduleCatalogue.forEach((m) => add({ name: moduleName(m), kind: 'module' }));
    fleet.stackCatalogue.forEach((m) => add({ name: moduleName(m), kind: 'stack' }));
    if (selectedEntry) add(selectedEntry);
    return Array.from(entries.values()).sort((a, b) => entryLabel(a).localeCompare(entryLabel(b)));
  }, [fleet.moduleCatalogue, fleet.stackCatalogue, selectedEntry]);

  // Calculated during render, so the first paint already has them.
  const { stats, allErrors } = React.useMemo(() => {
    const byEntry = new Map<string, { entry: IssueEntry; total: number; failed: number }>();
    const errors: Deployment[] = [];

    rawDeployments.forEach((d) => {
      const entry = entryOf(d);
      const key = entryKey(entry);

      // 1. Calculate Stats (Global - ignore filter)
      const counts = byEntry.get(key) ?? { entry, total: 0, failed: 0 };
      byEntry.set(key, counts);
      counts.total++;

      const isFailed = isFailedDeployment(d);

      if (isFailed) {
        counts.failed++;
      }

      // 2. Calculate Errors List (Apply Filter)
      if (isFailed) {
        let include = true;
        if (selectedEntry && key !== entryKey(selectedEntry)) include = false;
        if (selectedRegion && d.region !== selectedRegion) include = false;
        if (selectedAccount && d.project_id !== selectedAccount) include = false;

        if (include) {
          errors.push(d);
        }
      }
    });

    const processed = Array.from(byEntry.values(), ({ entry, total, failed }) => ({
      key: entryKey(entry),
      entry,
      label: entryLabel(entry),
      total,
      failed,
      rate: total > 0 ? (failed / total) * 100 : 0,
    }));

    // Sort by failed count desc
    processed.sort((a, b) => b.failed - a.failed);

    return { stats: processed, allErrors: errors };
  }, [rawDeployments, entryOf, selectedEntry, selectedRegion, selectedAccount]);
  const filtering = Boolean(selectedEntry || selectedRegion || selectedAccount);

  if (fleet.error) return <ResponseErrorPanel error={fleet.error} />;

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Box mb={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
            Back to Dashboard
          </Button>
        </Box>
        <FleetGate fleet={fleet}>
          <Grid container spacing={3}>
            {/* Top Modules Chart & Stats */}
            <Grid size={12}>
              <InfoCard title="Failure Overview">
                <Typography variant="body1" paragraph>
                  Identify modules with the highest number of failed deployments across all
                  projects.
                </Typography>

                {stats.some((s) => s.failed > 0) ? (
                  <Box sx={{ width: '100%', height: 400, mb: 4 }}>
                    <Typography variant="h6" align="center" gutterBottom>
                      Top Modules / Stacks by Failure Count
                    </Typography>
                    <BarChart
                      dataset={stats.slice(0, 10).filter((s) => s.failed > 0)}
                      xAxis={[{ scaleType: 'band', dataKey: 'label', label: 'Module / Stack' }]}
                      series={[
                        {
                          dataKey: 'failed',
                          label: 'Failed Deployments',
                          color: chartColors.failed,
                        },
                      ]}
                      height={350}
                    />
                  </Box>
                ) : (
                  <Typography
                    variant="body1"
                    sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}
                  >
                    No failed deployments found.
                  </Typography>
                )}

                <Typography variant="h6" gutterBottom>
                  Detailed Failure Stats
                </Typography>
                <Typography variant="body1" paragraph>
                  Breakdown of failure rates and totals for each module across all projects.
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Module / Stack Name</TableCell>
                        <TableCell align="right">Total Deployments</TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>
                          Failed
                        </TableCell>
                        <TableCell align="right">Failure Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                            <MuiLink
                              component="button"
                              variant="body2"
                              onClick={() => handleEntryClick(row.entry)}
                              underline="hover"
                              sx={{ fontWeight: 'medium', textAlign: 'left' }}
                            >
                              {row.label}
                            </MuiLink>
                          </TableCell>
                          <TableCell align="right">{row.total}</TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              color: row.failed > 0 ? 'error.main' : 'inherit',
                              fontWeight: row.failed > 0 ? 'bold' : 'normal',
                            }}
                          >
                            {row.failed}
                          </TableCell>
                          <TableCell align="right">{row.rate.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </InfoCard>
            </Grid>

            {/* Active Errors List & Filter */}
            <Grid size={12} ref={activeErrorsRef} sx={{ scrollMarginTop: 16 }}>
              <InfoCard title="Active Errors">
                <Typography variant="body1" paragraph>
                  Review and diagnose current deployment errors. Use filters to narrow down by
                  module, region, or account.
                </Typography>
                <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
                  <Autocomplete
                    options={entryOptions}
                    getOptionLabel={entryLabel}
                    isOptionEqualToValue={(option, value) => entryKey(option) === entryKey(value)}
                    value={selectedEntry}
                    onChange={(_, newValue) => setSelectedEntry(newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Filter by Module / Stack"
                        variant="outlined"
                        placeholder="All Modules / Stacks"
                      />
                    )}
                    sx={{ flexGrow: 1 }}
                  />
                  <Autocomplete
                    options={uniqueRegions}
                    value={selectedRegion}
                    onChange={(_, newValue) => setSelectedRegion(newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Filter by Region"
                        variant="outlined"
                        placeholder="All Regions"
                      />
                    )}
                    sx={{ flexGrow: 1 }}
                  />
                  <Autocomplete
                    options={uniqueAccounts}
                    value={selectedAccount}
                    onChange={(_, newValue) => setSelectedAccount(newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Filter by Account"
                        variant="outlined"
                        placeholder="All Accounts"
                      />
                    )}
                    sx={{ flexGrow: 1 }}
                  />
                </Box>

                <Typography variant="h6" gutterBottom>
                  Current active errors list ({allErrors.length})
                </Typography>
                {allErrors.length === 0 ? (
                  <Typography
                    variant="body1"
                    sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}
                  >
                    {filtering ? 'No active errors match the filters.' : 'No active errors found.'}
                  </Typography>
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 800 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Module / Stack</TableCell>
                          <TableCell>Deployment ID</TableCell>
                          <TableCell>Environment</TableCell>
                          <TableCell>Region</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Error Info</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {allErrors.map((d) => (
                          <TableRow key={deploymentKey(d)}>
                            <TableCell sx={{ fontWeight: 'medium' }}>
                              {entryLabel(entryOf(d))}
                            </TableCell>
                            <TableCell>
                              <Link to={deploymentLink(d)}>{d.deployment_id}</Link>
                            </TableCell>
                            <TableCell>{d.environment}</TableCell>
                            <TableCell>{d.region}</TableCell>
                            <TableCell sx={{ color: 'error.main' }}>{d.status}</TableCell>
                            <TableCell>
                              <Typography
                                variant="caption"
                                color="error"
                                sx={{ fontFamily: 'monospace' }}
                              >
                                {d.error_text || 'Unknown failure reason'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </InfoCard>
            </Grid>
          </Grid>
        </FleetGate>
      </Grid>
    </Grid>
  );
};

/**
 * Entry tile for one Adoption & Health view.
 *
 * Left-aligned with a small tinted glyph: the previous 60px centred icons read
 * as marketing tiles, and two of the three used the same red shield, which
 * signalled "something is wrong here" on a page where nothing is wrong yet.
 */
const DashboardCard = ({
  icon,
  tone,
  title,
  description,
  onClick,
}: {
  icon: React.ReactElement;
  tone: 'primary' | 'success' | 'warning';
  title: string;
  description: string;
  onClick: () => void;
}) => (
  <Card sx={{ height: '100%' }}>
    <CardActionArea
      onClick={onClick}
      // Column flex keeps content top-aligned; buttons centre it vertically by default.
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            display: 'grid',
            placeItems: 'center',
            mb: 1.5,
            color: `${tone}.main`,
            bgcolor: (theme) => alpha(theme.palette[tone].main, 0.1),
            '& svg': { fontSize: '1.125rem' },
          }}
        >
          {icon}
        </Box>
        <Typography variant="h5" component="h2" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </CardActionArea>
  </Card>
);

export const AdoptionHealthPage = () => {
  // In standalone, this component is rendered inside RootPage which is at /infraweave/adoption-health or /infraweave/adoption-health/:view
  // We can use the 'view' param from the router if available.
  const { view } = useParams<{ view: string }>();
  const navigate = useNavigate();

  // Default to dashboard
  const subView = view || 'dashboard';

  const handleNavigate = (targetView: string) => {
    if (targetView === 'dashboard') {
      navigate('/infraweave/adoption-health');
    } else {
      navigate(`/infraweave/adoption-health/${targetView}`);
    }
  };

  // Legacy route for the combined modules and stacks page.
  if (subView === 'usage') {
    return <Navigate to="/infraweave/adoption-health/module-usage" replace />;
  }

  if (subView === 'module-usage' || subView === 'stack-usage') {
    const kind: UsageKind = subView === 'stack-usage' ? 'stack' : 'module';
    return (
      // Keyed so switching views resets the selection.
      <UsageView key={kind} kind={kind} onBack={() => handleNavigate('dashboard')} />
    );
  }

  if (subView === 'velocity') {
    return <VelocityView onBack={() => handleNavigate('dashboard')} />;
  }

  if (subView === 'health') {
    return <DeploymentHealthView onBack={() => handleNavigate('dashboard')} />;
  }

  if (subView === 'issues') {
    return <ModuleIssuesView onBack={() => handleNavigate('dashboard')} />;
  }

  return (
    <Box>
      <PageHeading
        title="Adoption & Health"
        description="Which module and stack versions are deployed where, and which deployments are failing."
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <DashboardCard
            icon={<ModuleIcon />}
            tone="primary"
            title="Module Usage"
            description="Which modules are deployed, where, and on which versions. Track adoption of new module versions."
            onClick={() => handleNavigate('module-usage')}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <DashboardCard
            icon={<StackIcon />}
            tone="primary"
            title="Stack Usage"
            description="Which stacks are deployed, where, and on which versions. Track adoption of new stack versions."
            onClick={() => handleNavigate('stack-usage')}
          />

          {/* Velocity Card */}
          {/* <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                <Card sx={{ height: '100%' }}>
                    <CardActionArea onClick={() => handleNavigate('velocity')} sx={{ height: '100%', p: 2 }}>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <SpeedIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
                            <Typography variant="h5" component="div" gutterBottom>
                                Operational Velocity
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Track deployment frequency and success rates over time.
                                Measure team productivity and stability.
                            </Typography>
                        </CardContent>
                    </CardActionArea>
                </Card>
            </Grid> */}
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <DashboardCard
            icon={<MonitorHeartIcon />}
            tone="success"
            title="Deployment Health"
            description="Identify failed or drifting deployments. Find environments that need attention."
            onClick={() => handleNavigate('health')}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <DashboardCard
            icon={<ReportProblemIcon />}
            tone="warning"
            title="Module Issues"
            description="View modules with the highest failure rates. Diagnose and resolve issues quickly."
            onClick={() => handleNavigate('issues')}
          />
        </Grid>
      </Grid>
    </Box>
  );
};
