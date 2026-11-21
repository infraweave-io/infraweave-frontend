import React, { useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Card,
  CardContent,
  CardHeader,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { FramedTableContainer } from '../../../standalone/components/ComponentAdapter';
import type { Deployment } from '../../../types/Deployment';
import {
  SegmentedToggle,
  type SegmentedToggleOption,
} from '../../../shared/components/SegmentedToggle';
import { compareVersions, type VersionOrder } from '../../../utils/version';
import { COUNT_NOUN, type CountNoun, type UsageKind } from './usageContext';

export type VersionDistributionCardProps = {
  kind: UsageKind;
  deployments: Deployment[];
  onVersionClick: (version: string) => void;
  /** What the counts count. */
  countNoun?: CountNoun;
};

type VersionDistributionRow = {
  version: string;
  total: number;
  regions: Record<string, number>;
};

type VersionChartRow = {
  version: string;
} & Record<string, number | string>;

type VersionSortKey = 'version' | 'count';

const SORT_KEY_OPTIONS: readonly SegmentedToggleOption<VersionSortKey>[] = [
  { value: 'version', label: 'Version' },
  { value: 'count', label: 'Count' },
];

const SORT_ORDER_OPTIONS: readonly SegmentedToggleOption<VersionOrder>[] = [
  { value: 'desc', label: 'Desc' },
  { value: 'asc', label: 'Asc' },
];

export const VersionDistributionCard = ({
  kind,
  deployments,
  onVersionClick,
  countNoun = COUNT_NOUN.standalone,
}: VersionDistributionCardProps) => {
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<VersionSortKey>('version');
  const [sortOrder, setSortOrder] = useState<VersionOrder>('desc');

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
    // Count ties fall back to version order so rows never shuffle between renders.
    const filteredStats = Array.from(versionMap.values()).sort((left, right) => {
      if (sortKey === 'count' && left.total !== right.total) {
        return sortOrder === 'asc' ? left.total - right.total : right.total - left.total;
      }
      return compareVersions(left.version, right.version, sortOrder);
    });
    const chartDataset: VersionChartRow[] = filteredStats.map((row) => {
      const chartRow: VersionChartRow = { version: row.version };
      for (const region of chartRegions) chartRow[region] = row.regions[region] ?? 0;
      return chartRow;
    });

    return { filteredStats, chartRegions, chartDataset };
  }, [deployments, activeStatuses, sortKey, sortOrder]);

  return (
    <Card variant="outlined" sx={{ width: '100%' }}>
      <CardHeader
        title="Version Distribution by Region"
        titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      />
      <CardContent>
        {/* Status filter is card-local so the overview keeps showing failures. */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
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
          <SegmentedToggle<VersionSortKey>
            value={sortKey}
            options={SORT_KEY_OPTIONS}
            onChange={setSortKey}
            ariaLabel="Sort versions by"
          />
          <SegmentedToggle<VersionOrder>
            value={sortOrder}
            options={SORT_ORDER_OPTIONS}
            onChange={setSortOrder}
            ariaLabel="Sort order"
          />
        </Box>

        {filteredStats.length === 0 && (
          <Typography color="text.secondary">
            {deployments.length === 0
              ? `No active ${countNoun.plural} found for this ${kind}.`
              : `No ${countNoun.plural} match the selected statuses.`}
          </Typography>
        )}

        {filteredStats.length > 0 && (
          <>
            <Box sx={{ width: '100%', mb: 2 }}>
              <Typography variant="h6" gutterBottom align="center">
                Active {countNoun.plural} by version
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

            <FramedTableContainer>
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
            </FramedTableContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
};
