import React, { useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Card,
  CardContent,
  CardHeader,
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
import { BarChart } from '@mui/x-charts/BarChart';
import type { Deployment } from '../../../types/Deployment';
import type { UsageKind } from './usageContext';

export type VersionDistributionCardProps = {
  kind: UsageKind;
  deployments: Deployment[];
  onVersionClick: (version: string) => void;
};

type VersionDistributionRow = {
  version: string;
  total: number;
  regions: Record<string, number>;
};

type VersionChartRow = {
  version: string;
} & Record<string, number | string>;

export const VersionDistributionCard = ({
  kind,
  deployments,
  onVersionClick,
}: VersionDistributionCardProps) => {
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const availableStatuses = useMemo(
    () =>
      Array.from(new Set(deployments.map((deployment) => deployment.status)))
        .filter(Boolean)
        .sort(),
    [deployments],
  );
  const activeStatuses = useMemo(
    () => statusFilter.filter((status) => availableStatuses.includes(status)),
    [statusFilter, availableStatuses],
  );

  const { filteredStats, chartRegions, chartDataset } = useMemo(() => {
    const filteredDeployments =
      activeStatuses.length > 0
        ? deployments.filter((deployment) => activeStatuses.includes(deployment.status))
        : deployments;
    const versionMap = new Map<string, VersionDistributionRow>();
    const foundRegions = new Set<string>();

    for (const deployment of filteredDeployments) {
      const version =
        deployment.module_version || (deployment as Deployment & { version?: string }).version;
      const region = deployment.region;
      if (!version || !region) continue;

      foundRegions.add(region);
      let row = versionMap.get(version);
      if (!row) {
        row = { version, total: 0, regions: {} };
        versionMap.set(version, row);
      }
      row.regions[region] = (row.regions[region] ?? 0) + 1;
      row.total += 1;
    }

    const chartRegions = Array.from(foundRegions).sort();
    const filteredStats = Array.from(versionMap.values()).sort(
      (left, right) => right.total - left.total,
    );
    const chartDataset: VersionChartRow[] = filteredStats.map((row) => {
      const chartRow: VersionChartRow = { version: row.version };
      for (const region of chartRegions) chartRow[region] = row.regions[region] ?? 0;
      return chartRow;
    });

    return { filteredStats, chartRegions, chartDataset };
  }, [deployments, activeStatuses]);

  return (
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
            {deployments.length === 0
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
                dataset={chartDataset}
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
                  {filteredStats.map((row) => (
                    <TableRow key={row.version}>
                      <TableCell component="th" scope="row">
                        <MuiLink
                          component="button"
                          variant="body2"
                          onClick={() => onVersionClick(row.version)}
                          underline="hover"
                        >
                          {row.version}
                        </MuiLink>
                      </TableCell>
                      {chartRegions.map((region) => (
                        <TableCell key={region} align="right">
                          {row.regions[region] ?? 0}
                        </TableCell>
                      ))}
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        {row.total}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
};
