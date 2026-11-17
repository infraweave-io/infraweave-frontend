import React, { useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Grid,
  Link as MuiLink,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { BarChart } from '@mui/x-charts/BarChart';
import {
  InfoCard,
  Link,
  ResponseErrorPanel,
} from '../../../standalone/components/ComponentAdapter';
import { useChartStatusColors } from '../../../contexts/ThemeContext';
import type { Deployment } from '../../../types/Deployment';
import { isFailedDeployment } from '../../../utils/deploymentStatus';
import { deploymentKey, deploymentLink } from './deploymentViewUtils';
import { FleetGate } from './FleetStatus';
import { isStackDeployment, moduleName, useFleetDeployments } from './useFleetDeployments';
import { scrollToSection } from './OverviewParts';
import type { UsageKind } from './usageContext';

/** A module or a stack: the two can share a name, so the kind is part of what it is. */
type IssueEntry = { name: string; kind: UsageKind };

const entryKey = (entry: IssueEntry) => `${entry.kind}:${entry.name}`;

const entryLabel = (entry: IssueEntry) =>
  entry.kind === 'stack' ? `${entry.name} (stack)` : entry.name;

type IssueStatsRow = {
  key: string;
  entry: IssueEntry;
  label: string;
  total: number;
  failed: number;
  rate: number;
};

type IssueCounts = { entry: IssueEntry; total: number; failed: number };

const matchesIssueFilters = (
  deployment: Deployment,
  key: string,
  selectedEntry: IssueEntry | null,
  selectedRegion: string | null,
  selectedAccount: string | null,
) =>
  (!selectedEntry || key === entryKey(selectedEntry)) &&
  (!selectedRegion || deployment.region === selectedRegion) &&
  (!selectedAccount || deployment.project_id === selectedAccount);

const summarizeIssues = (
  deployments: Deployment[],
  entryOf: (deployment: Deployment) => IssueEntry,
  selectedEntry: IssueEntry | null,
  selectedRegion: string | null,
  selectedAccount: string | null,
) => {
  const byEntry = new Map<string, IssueCounts>();
  const errors: Deployment[] = [];

  for (const deployment of deployments) {
    const entry = entryOf(deployment);
    const key = entryKey(entry);
    const counts = byEntry.get(key) ?? { entry, total: 0, failed: 0 };
    counts.total += 1;

    const failed = isFailedDeployment(deployment);
    if (failed) {
      counts.failed += 1;
      if (matchesIssueFilters(deployment, key, selectedEntry, selectedRegion, selectedAccount)) {
        errors.push(deployment);
      }
    }

    byEntry.set(key, counts);
  }

  const stats: IssueStatsRow[] = Array.from(byEntry.values(), ({ entry, total, failed }) => ({
    key: entryKey(entry),
    entry,
    label: entryLabel(entry),
    total,
    failed,
    rate: total > 0 ? (failed / total) * 100 : 0,
  }));
  stats.sort((a, b) => b.failed - a.failed);

  return { stats, allErrors: errors };
};

export const ModuleIssuesView = ({ onBack }: { onBack: () => void }) => {
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
  const { stats, allErrors } = React.useMemo(
    () => summarizeIssues(rawDeployments, entryOf, selectedEntry, selectedRegion, selectedAccount),
    [rawDeployments, entryOf, selectedEntry, selectedRegion, selectedAccount],
  );
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
