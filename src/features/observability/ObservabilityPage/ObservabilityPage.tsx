import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { Deployment } from '../../../types/Deployment';
import { Event } from '../../../types/Event';
import { Module } from '../../../types/Module';
import { DeploymentsDialog } from '../../modules/detail/ModuleVersions';

const ModuleUsageView = ({
  onBack,
  onViewIssues,
}: {
  onBack: () => void;
  onViewIssues: () => void;
}) => {
  const config = useConfig();
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [rawDeployments, setRawDeployments] = useState<Deployment[]>([]);
  const [_allErrors, _setAllErrors] = useState<Deployment[]>([]);
  const [filteredStats, setFilteredStats] = useState<Record<string, any>[]>([]);
  const [chartRegions, setChartRegions] = useState<string[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);

  const [loadingModules, setLoadingModules] = useState(true);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Deployments Dialog State
  const [openDeployments, setOpenDeployments] = useState(false);
  const [selectedVersionForModal, setSelectedVersionForModal] = useState<string>('');

  const handleVersionClick = (version: string) => {
    setSelectedVersionForModal(version);
    setOpenDeployments(true);
  };

  // Fetch Modules and Stacks
  useEffect(() => {
    const fetchModules = async () => {
      setLoadingModules(true);
      try {
        const modulesUrl = config.getApiUrl(
          'api/proxy/api/infraweave/api/v1/modules?fields=module,module_name,track,version',
        );
        const stacksUrl = config.getApiUrl(
          'api/proxy/api/infraweave/api/v1/stacks?fields=module,module_name,track,version',
        );

        const [modulesResp, stacksResp] = await Promise.all([
          config.fetch(modulesUrl),
          config.fetch(stacksUrl).catch(() => ({ ok: false })), // Handle optional stacks failure
        ]);

        if (!modulesResp.ok) throw new Error('Failed to fetch modules');

        const modulesJson = await modulesResp.json();
        const stacksJson = (stacksResp as any).ok ? await (stacksResp as any).json() : [];

        const moduleItems = modulesJson.Items || modulesJson.items || modulesJson;
        const stackItems = stacksJson.Items || stacksJson.items || stacksJson || [];

        const allItems = [...moduleItems, ...stackItems];

        // Deduplicate by module name
        const uniqueModules = new Map<string, Module>();
        allItems.forEach((item: Module) => {
          const name = item.module || item.module_name;
          if (name && !uniqueModules.has(name)) {
            uniqueModules.set(name, item);
          }
        });

        setModules(Array.from(uniqueModules.values()));
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoadingModules(false);
      }
    };
    fetchModules();
  }, [config]);

  // Fetch Deployments when module selected
  useEffect(() => {
    if (!selectedModule) {
      setRawDeployments([]);
      setAvailableStatuses([]);
      return;
    }

    // Reset filters on module change
    setStatusFilter([]);

    const fetchDeployments = async () => {
      setLoadingDeployments(true);
      try {
        // Fetch projects
        const projectsResp = await config.fetch(
          config.getApiUrl('api/proxy/api/infraweave/api/v1/projects'),
        );
        const projects = await projectsResp.json();
        const projectIds = projects.map((p: any) => p.project_id);
        const regions = Array.from(
          new Set(projects.flatMap((p: any) => p.regions || [])),
        ) as string[];
        const projectIdsString = projectIds.join(',');

        if (regions.length === 0 || projectIds.length === 0) {
          setRawDeployments([]);
          setAvailableStatuses([]);
          return;
        }

        const moduleName = selectedModule.module || selectedModule.module_name || '';

        // Fetch deployments for each region
        const promises = regions.map((region) =>
          config
            .fetch(
              config.getApiUrl(
                `api/proxy/api/infraweave/api/v1/deployments/module/${projectIdsString}/${region}/${moduleName}`,
              ),
            )
            .then((r) => (r.ok ? r.json() : []))
            .then((json) => (json.Items || json.items || json) as Deployment[])
            .catch(() => []),
        );

        const results = await Promise.all(promises);
        const allDeployments = results.flat();

        const uniqueStatuses = Array.from(new Set(allDeployments.map((d) => d.status))).filter(
          Boolean,
        ) as string[];

        setRawDeployments(allDeployments);
        setAvailableStatuses(uniqueStatuses.sort());
      } catch (e) {
        console.error('Failed to fetch deployments', e);
      } finally {
        setLoadingDeployments(false);
      }
    };

    fetchDeployments();
  }, [selectedModule, config]);

  // Calculate Stats based on filters
  useEffect(() => {
    const filteredDeployments =
      statusFilter.length > 0
        ? rawDeployments.filter((d) => statusFilter.includes(d.status))
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

    setChartRegions(Array.from(foundRegions).sort());
    setFilteredStats(statsData);
  }, [rawDeployments, statusFilter]);

  // Deployment Types and Resource Kinds Stats
  const [kindStats, setKindStats] = useState<{ id: string; value: number; label: string }[]>([]);
  const [resourceKindStats, setResourceKindStats] = useState<
    { id: string; value: number; label: string }[]
  >([]);

  // Fetch Global Stats (Deployment Types & Resource Kinds)
  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        const projectsResp = await config.fetch(
          config.getApiUrl('api/proxy/api/infraweave/api/v1/projects'),
        );
        const projects = await projectsResp.json();
        const projectIds = projects.map((p: any) => p.project_id);
        const regions = Array.from(
          new Set(projects.flatMap((p: any) => p.regions || [])),
        ) as string[];
        const projectIdsString = projectIds.join(',');

        if (regions.length === 0 || projectIds.length === 0) return;

        const promises = regions.map((region) =>
          config
            .fetch(
              config.getApiUrl(
                `api/proxy/api/infraweave/api/v1/deployments/${projectIdsString}/${region}`,
              ),
            )
            .then((r) => (r.ok ? r.json() : []))
            .then((json) => (json.Items || json.items || json) as Deployment[])
            .catch(() => []),
        );

        const results = await Promise.all(promises);
        const allDeployments = results.flat();

        // Deployment Types
        const kindCounts: Record<string, number> = {};
        allDeployments.forEach((d) => {
          const type = d.module_type || 'regular';
          kindCounts[type] = (kindCounts[type] || 0) + 1;
        });
        setKindStats(
          Object.entries(kindCounts).map(([type, count]) => ({
            id: type,
            value: count,
            label: type.charAt(0).toUpperCase() + type.slice(1),
          })),
        );

        // Resource Kinds
        const moduleCounts: Record<string, number> = {};
        allDeployments.forEach((d) => {
          const mod = d.module || 'unknown';
          moduleCounts[mod] = (moduleCounts[mod] || 0) + 1;
        });
        const modData = Object.entries(moduleCounts).map(([mod, count]) => ({
          id: mod,
          value: count,
          label: mod,
        }));
        modData.sort((a, b) => b.value - a.value);
        setResourceKindStats(modData);
      } catch (e) {
        console.error('Failed to fetch global stats for module usage view', e);
      }
    };
    fetchGlobalStats();
  }, [config]);

  // Pre-select the most active module once stats are loaded - REMOVED
  // User requested removal of auto-select
  useEffect(() => {
    setSelectedModule(null);
    setRawDeployments([]);
    setFilteredStats([]);
  }, []);

  if (loadingModules) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
            Back to Dashboard
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<HealthAndSafetyIcon />}
            onClick={onViewIssues}
          >
            View Problematic Modules
          </Button>
        </Box>

        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <InfoCard title="Deployment Types">
              <Typography variant="body1" paragraph>
                Distribution of deployments by module type across all projects.
              </Typography>
              <Box sx={{ width: '100%', height: 250, display: 'flex', justifyContent: 'center' }}>
                <PieChart
                  series={[
                    {
                      data: kindStats,
                      innerRadius: 30,
                      outerRadius: 80,
                      paddingAngle: 5,
                      cornerRadius: 5,
                    },
                  ]}
                  height={250}
                  margin={{ right: 200 }}
                />
              </Box>
            </InfoCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <InfoCard title="Active Modules Share">
              <Typography variant="body1" paragraph>
                Proportion of total deployments contributed by each module/stack across all
                projects.
              </Typography>
              <Box sx={{ width: '100%', height: 250, display: 'flex', justifyContent: 'center' }}>
                <PieChart
                  series={[
                    {
                      data: resourceKindStats,
                      innerRadius: 30,
                      outerRadius: 80,
                      paddingAngle: 5,
                      cornerRadius: 5,
                    },
                  ]}
                  height={250}
                  margin={{ right: 200 }}
                />
              </Box>
            </InfoCard>
          </Grid>
        </Grid>

        <Card variant="outlined" sx={{ width: '100%' }}>
          <CardHeader
            title="Module Version Distribution"
            titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          />
          <CardContent>
            <Typography variant="body1" paragraph>
              Select a module to view its deployment usage across versions.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: selectedModule ? 3 : 0 }}>
              <Autocomplete
                options={modules}
                getOptionLabel={(option) => option.module || option.module_name || ''}
                value={selectedModule}
                onChange={(_, newValue) => setSelectedModule(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Select Module" variant="outlined" />
                )}
                sx={{ width: 300 }}
              />

              {selectedModule && (
                <Autocomplete
                  multiple
                  options={availableStatuses}
                  value={statusFilter}
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
              )}
            </Box>

            {loadingDeployments && <Progress />}

            {!loadingDeployments && selectedModule && filteredStats.length === 0 && (
              <Typography>No active deployments found for this module.</Typography>
            )}

            {!loadingDeployments && filteredStats.length > 0 && (
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
                {openDeployments && (
                  <DeploymentsDialog
                    open={openDeployments}
                    onClose={() => setOpenDeployments(false)}
                    moduleName={selectedModule.module || selectedModule.module_name || ''}
                    version={selectedVersionForModal}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

const VelocityView = ({ onBack }: { onBack: () => void }) => {
  const config = useConfig();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ date: string; success: number; failed: number }[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [timeframe, setTimeframe] = useState(30);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch projects
        const projectsResp = await config.fetch(
          config.getApiUrl('api/proxy/api/infraweave/api/v1/projects'),
        );
        const projects = await projectsResp.json();
        const projectIds = projects.map((p: any) => p.project_id);
        const regions = Array.from(
          new Set(projects.flatMap((p: any) => p.regions || [])),
        ) as string[];
        const projectIdsString = projectIds.join(',');

        if (regions.length === 0 || projectIds.length === 0) {
          setStats([]);
          return;
        }

        // Fetch deployments for each region first
        const deploymentPromises = regions.map((region) =>
          config
            .fetch(
              config.getApiUrl(
                `api/proxy/api/infraweave/api/v1/deployments/${projectIdsString}/${region}`,
              ),
            )
            .then((r) => (r.ok ? r.json() : []))
            .then((json) => (json.Items || json.items || json) as Deployment[])
            .catch(() => []),
        );

        const deploymentResults = await Promise.all(deploymentPromises);
        const allDeployments = deploymentResults.flat();

        // Fetch events for each deployment to get history
        // Note: This issues N requests where N is the number of deployments.
        const eventPromises = allDeployments.map((d) => {
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
        });

        const eventsResults = await Promise.all(eventPromises);
        const allEvents = eventsResults.flat();

        // Group by Date (YYYY-MM-DD)
        const grouped: Record<string, { success: number; failed: number }> = {};

        allEvents.forEach((e) => {
          if (!e.epoch) return;
          const date = new Date(e.epoch).toISOString().split('T')[0];

          if (!grouped[date]) {
            grouped[date] = { success: 0, failed: 0 };
          }

          if (e.status === 'successful' || e.status === 'active' || e.status === 'success') {
            grouped[date].success++;
          } else if (e.status === 'failed' || e.status === 'error') {
            grouped[date].failed++;
          }
        });

        // Fill details for last N days
        const today = new Date();
        const chartData = [];
        for (let i = timeframe - 1; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          chartData.push({
            date: dateStr,
            success: grouped[dateStr]?.success || 0,
            failed: grouped[dateStr]?.failed || 0,
          });
        }

        setStats(chartData);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [config, timeframe]);

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Box mb={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
            Back to Dashboard
          </Button>
        </Box>
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
                { dataKey: 'success', label: 'Successful Deployments', color: '#4caf50' },
                { dataKey: 'failed', label: 'Failed Deployments', color: '#f44336' },
              ]}
              height={350}
            />
          </Box>
        </InfoCard>
      </Grid>
    </Grid>
  );
};

const DeploymentHealthView = ({ onBack }: { onBack: () => void }) => {
  const config = useConfig();
  const [loading, setLoading] = useState(true);
  const [statusStats, setStatusStats] = useState<
    { id: string; value: number; label: string; color: string }[]
  >([]);
  const [errorDeployments, setErrorDeployments] = useState<Deployment[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch projects
        const projectsResp = await config.fetch(
          config.getApiUrl('api/proxy/api/infraweave/api/v1/projects'),
        );
        const projects = await projectsResp.json();
        const projectIds = projects.map((p: any) => p.project_id);
        const regions = Array.from(
          new Set(projects.flatMap((p: any) => p.regions || [])),
        ) as string[];
        const projectIdsString = projectIds.join(',');

        if (regions.length === 0 || projectIds.length === 0) {
          setLoading(false);
          return;
        }

        // Fetch deployments for each region
        const promises = regions.map((region) =>
          config
            .fetch(
              config.getApiUrl(
                `api/proxy/api/infraweave/api/v1/deployments/${projectIdsString}/${region}`,
              ),
            )
            .then((r) => (r.ok ? r.json() : []))
            .then((json) => (json.Items || json.items || json) as Deployment[])
            .catch(() => []),
        );

        const results = await Promise.all(promises);
        const allDeployments = results.flat();

        // 1. Status Ratio
        const statusCounts: Record<string, number> = {};
        allDeployments.forEach((d) => {
          const status = d.status || 'unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        const statusData = Object.entries(statusCounts).map(([status, count], _index) => {
          let color = '#9e9e9e'; // default grey
          if (status === 'successful' || status === 'active') color = '#4caf50'; // green
          if (status === 'failed' || status === 'error') color = '#f44336'; // red
          if (status === 'in-progress') color = '#2196f3'; // blue

          return {
            id: status,
            value: count,
            label: status.charAt(0).toUpperCase() + status.slice(1),
            color: color,
          };
        });
        setStatusStats(statusData);

        // 4. Error Deployments
        const errors = allDeployments.filter(
          (d) =>
            d.status === 'failed' ||
            d.status === 'error' ||
            (d.error_text && d.error_text.length > 0),
        );
        setErrorDeployments(errors);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [config]);

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Box mb={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
            Back to Dashboard
          </Button>
        </Box>
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
                  slotProps={{ legend: { hidden: true } as any }}
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
                        <TableRow key={d.deployment_id}>
                          <TableCell sx={{ fontWeight: 'medium' }}>
                            <Link to={`/infraweave/deployment/${d.environment}/${d.deployment_id}`}>
                              {d.deployment_id}
                            </Link>
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
      </Grid>
    </Grid>
  );
};

const ModuleIssuesView = ({ onBack }: { onBack: () => void }) => {
  const config = useConfig();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<
    { module: string; total: number; failed: number; rate: number }[]
  >([]);
  const [error, setError] = useState<Error | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [rawDeployments, setRawDeployments] = useState<Deployment[]>([]);
  const [allErrors, setAllErrors] = useState<Deployment[]>([]);

  const uniqueRegions = Array.from(new Set(rawDeployments.map((d) => d.region)))
    .filter(Boolean)
    .sort();
  const uniqueAccounts = Array.from(new Set(rawDeployments.map((d) => d.project_id)))
    .filter(Boolean)
    .sort();

  const handleModuleClick = (moduleName: string) => {
    const mod = modules.find((m) => (m.module || m.module_name) === moduleName);
    if (mod) {
      setSelectedModule(mod);
      // Optionally scroll to Active Errors list?
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch modules and stacks
        const modulesUrl = config.getApiUrl(
          'api/proxy/api/infraweave/api/v1/modules?fields=module,module_name,track,version',
        );
        const stacksUrl = config.getApiUrl(
          'api/proxy/api/infraweave/api/v1/stacks?fields=module,module_name,track,version',
        );

        const [modulesResp, stacksResp] = await Promise.all([
          config.fetch(modulesUrl),
          config.fetch(stacksUrl).catch(() => ({ ok: false })), // Handle optional stacks failure gracefully
        ]);

        if (modulesResp.ok) {
          const modulesJson = await modulesResp.json();
          const stacksJson = (stacksResp as any).ok ? await (stacksResp as any).json() : [];

          const moduleItems = modulesJson.Items || modulesJson.items || modulesJson;
          const stackItems = stacksJson.Items || stacksJson.items || stacksJson || [];

          const allItems = [...moduleItems, ...stackItems];

          const uniqueModules = new Map<string, Module>();
          allItems.forEach((item: Module) => {
            const name = item.module || item.module_name;
            if (name && !uniqueModules.has(name)) {
              uniqueModules.set(name, item);
            }
          });
          setModules(Array.from(uniqueModules.values()));
        }

        // Fetch Projects
        const projectsResp = await config.fetch(
          config.getApiUrl('api/proxy/api/infraweave/api/v1/projects'),
        );
        const projects = await projectsResp.json();
        const projectIds = projects.map((p: any) => p.project_id);
        const regions = Array.from(
          new Set(projects.flatMap((p: any) => p.regions || [])),
        ) as string[];
        const projectIdsString = projectIds.join(',');

        if (regions.length === 0 || projectIds.length === 0) {
          setLoading(false);
          return;
        }

        const promises = regions.map((region) =>
          config
            .fetch(
              config.getApiUrl(
                `api/proxy/api/infraweave/api/v1/deployments/${projectIdsString}/${region}`,
              ),
            )
            .then((r) => (r.ok ? r.json() : []))
            .then((json) => (json.Items || json.items || json) as Deployment[])
            .catch(() => []),
        );

        const results = await Promise.all(promises);
        const allDeployments = results.flat();
        setRawDeployments(allDeployments);

        // Initial processing
        processData(allDeployments, null, null, null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [config]);

  const processData = (
    deployments: Deployment[],
    filterModule: Module | null,
    filterRegion: string | null,
    filterAccount: string | null,
  ) => {
    const moduleMap: Record<string, { total: number; failed: number }> = {};
    const errors: Deployment[] = [];

    deployments.forEach((d) => {
      const mod = d.module || 'unknown';

      // 1. Calculate Stats (Global - ignore filter)
      if (!moduleMap[mod]) {
        moduleMap[mod] = { total: 0, failed: 0 };
      }
      moduleMap[mod].total++;

      const status = (d.status || '').toLowerCase();
      const hasErrorText = d.error_text && d.error_text.trim().length > 0;
      const isFailureStatus = [
        'failed',
        'error',
        'failure',
        'timed_out',
        'cancelled',
        'rolled_back',
      ].includes(status);
      const isFailed = isFailureStatus || hasErrorText;

      if (isFailed) {
        moduleMap[mod].failed++;
      }

      // 2. Calculate Errors List (Apply Filter)
      if (isFailed) {
        let include = true;
        if (filterModule) {
          const filterName = filterModule.module || filterModule.module_name;
          if (mod !== filterName) include = false;
        }
        if (filterRegion && d.region !== filterRegion) include = false;
        if (filterAccount && d.project_id !== filterAccount) include = false;

        if (include) {
          errors.push(d);
        }
      }
    });

    const processed = Object.entries(moduleMap).map(([mod, counts]) => ({
      module: mod,
      total: counts.total,
      failed: counts.failed,
      rate: counts.total > 0 ? (counts.failed / counts.total) * 100 : 0,
    }));

    // Sort by failed count desc
    processed.sort((a, b) => b.failed - a.failed);

    setStats(processed);
    setAllErrors(errors);
  };

  // Update processing when selection changes
  useEffect(() => {
    if (rawDeployments.length > 0) {
      processData(rawDeployments, selectedModule, selectedRegion, selectedAccount);
    }
  }, [selectedModule, selectedRegion, selectedAccount, rawDeployments]);

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Box mb={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
            Back to Dashboard
          </Button>
        </Box>

        <Grid container spacing={3}>
          {/* Top Modules Chart & Stats */}
          <Grid size={12}>
            <InfoCard title="Failure Overview">
              <Typography variant="body1" paragraph>
                Identify modules with the highest number of failed deployments across all projects.
              </Typography>

              {stats.some((s) => s.failed > 0) ? (
                <Box sx={{ width: '100%', height: 400, mb: 4 }}>
                  <Typography variant="h6" align="center" gutterBottom>
                    Top Modules / Stacks by Failure Count
                  </Typography>
                  <BarChart
                    dataset={stats.slice(0, 10).filter((s) => s.failed > 0)}
                    xAxis={[{ scaleType: 'band', dataKey: 'module', label: 'Module / Stack' }]}
                    series={[{ dataKey: 'failed', label: 'Failed Deployments', color: '#f44336' }]}
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
                      <TableRow key={row.module}>
                        <TableCell component="th" scope="row" sx={{ fontWeight: 'medium' }}>
                          <MuiLink
                            component="button"
                            variant="body2"
                            onClick={() => handleModuleClick(row.module)}
                            underline="hover"
                            sx={{ fontWeight: 'medium', textAlign: 'left' }}
                          >
                            {row.module}
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
          <Grid size={12}>
            <InfoCard title="Active Errors">
              <Typography variant="body1" paragraph>
                Review and diagnose current deployment errors. Use filters to narrow down by module,
                region, or account.
              </Typography>
              <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
                <Autocomplete
                  options={modules}
                  getOptionLabel={(option) => option.module || option.module_name || ''}
                  value={selectedModule}
                  onChange={(_, newValue) => setSelectedModule(newValue)}
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
                  No active errors found {selectedModule ? 'for this module' : ''}.
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
                        <TableRow key={d.deployment_id}>
                          <TableCell sx={{ fontWeight: 'medium' }}>{d.module}</TableCell>
                          <TableCell>
                            <Link to={`/infraweave/deployment/${d.environment}/${d.deployment_id}`}>
                              {d.deployment_id}
                            </Link>
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
      </Grid>
    </Grid>
  );
};

export const ObservabilityPage = () => {
  // In standalone, this component is rendered inside RootPage which is at /infraweave/observability or /infraweave/observability/:view
  // We can use the 'view' param from the router if available.
  const { view } = useParams<{ view: string }>();
  const navigate = useNavigate();

  // Default to dashboard
  const subView = view || 'dashboard';

  const handleNavigate = (targetView: string) => {
    if (targetView === 'dashboard') {
      navigate('/infraweave/observability');
    } else {
      navigate(`/infraweave/observability/${targetView}`);
    }
  };

  if (subView === 'usage') {
    return (
      <ModuleUsageView
        onBack={() => handleNavigate('dashboard')}
        onViewIssues={() => handleNavigate('issues')}
      />
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
    <Grid container spacing={4}>
      <Grid size={12}>
        <Typography variant="h4" gutterBottom>
          Observability Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary" paragraph>
          Monitor your infrastructure, analyze usage patterns, and detect issues.
        </Typography>
      </Grid>

      {/* Assessment / Usage Card */}
      <Grid size={{ xs: 12, md: 6, lg: 4 }}>
        <Card sx={{ height: '100%' }}>
          <CardActionArea onClick={() => handleNavigate('usage')} sx={{ height: '100%', p: 2 }}>
            <CardContent
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <AssessmentIcon color="primary" sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h5" component="div" gutterBottom>
                Module Usage
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Analyze deployment distribution across versions and regions. Track adoption of new
                module versions.
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Grid>

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

      {/* Health / Bad Deployments Card */}
      <Grid size={{ xs: 12, md: 6, lg: 4 }}>
        <Card sx={{ height: '100%' }}>
          <CardActionArea onClick={() => handleNavigate('health')} sx={{ height: '100%', p: 2 }}>
            <CardContent
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <HealthAndSafetyIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h5" component="div" gutterBottom>
                Deployment Health
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Identify failed or drifting deployments. Find environments that need attention.
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Grid>

      {/* Module Issues Card */}
      <Grid size={{ xs: 12, md: 6, lg: 4 }}>
        <Card sx={{ height: '100%' }}>
          <CardActionArea onClick={() => handleNavigate('issues')} sx={{ height: '100%', p: 2 }}>
            <CardContent
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <HealthAndSafetyIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
              <Typography variant="h5" component="div" gutterBottom>
                Module Issues
              </Typography>
              <Typography variant="body2" color="text.secondary">
                View modules with the highest failure rates. Diagnose and resolve issues quickly.
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Grid>
    </Grid>
  );
};
