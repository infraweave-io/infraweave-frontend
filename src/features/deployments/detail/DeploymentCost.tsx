import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { BarChart } from '@mui/x-charts/BarChart';
import { InfoCard } from '../../../standalone/components/ComponentAdapter';
import { useConfig } from '../../../hooks/useConfig';
import { useAsync } from '../../../hooks/useAsync';
import { useChartCategoricalColors } from '../../../contexts/ThemeContext';
import { Deployment } from '../../../types/Deployment';
import {
  CostGranularity,
  DeploymentCost as DeploymentCostResult,
  ResourceCosts,
} from '../../../types/Cost';
import {
  COST_DIMENSIONS,
  COST_RANGES,
  COST_TAG,
  DEFAULT_COST_PERIODS,
  OTHER_LABEL,
  assignSeriesSlots,
  buildCostChart,
  costGroupLabel,
  costQueryString,
  formatCost,
  formatCostTick,
  topCostLabels,
} from '../../../utils/cost';
import { CostShareTable, ResourceIdLabel } from '../../cost/CostTables';
import { CostMetric, CostMetricToggle, DEFAULT_COST_METRIC } from '../../cost/CostMetricToggle';

/** Not a Cost Explorer dimension: resource costs come from its resource-level data. */
const RESOURCE = 'RESOURCE';

const GROUP_BY_OPTIONS = [
  ...COST_DIMENSIONS,
  { value: RESOURCE, label: 'Resource (last 14 days)' },
];

const RESOURCE_DAYS = [
  { days: 1, label: 'Today' },
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
];

interface DeploymentCostProps {
  deployment?: Deployment;
}

const fetchJson = async (config: ReturnType<typeof useConfig>, path: string) => {
  const response = await config.fetch(config.getApiUrl(`api/proxy/api/infraweave/api/v1/${path}`));
  const json = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(json?.error ?? `Request failed: ${response.status}`);
  }
  return json;
};

export const DeploymentCost: React.FC<DeploymentCostProps> = ({ deployment }) => {
  const config = useConfig();
  const theme = useTheme();
  const colors = useChartCategoricalColors();
  const [granularity, setGranularity] = useState<CostGranularity>('DAILY');
  const [periods, setPeriods] = useState(DEFAULT_COST_PERIODS.DAILY);
  const [resourceDays, setResourceDays] = useState(14);
  const [groupBy, setGroupBy] = useState('SERVICE');
  const [metric, setMetric] = useState<CostMetric>(DEFAULT_COST_METRIC);
  // Colour per dimension value, kept across refetches so a series is not repainted
  // when another one enters or leaves the chart.
  const slotMemory = useRef<ReadonlyMap<string, number>>(new Map());

  const projectId = deployment?.project_id;
  const region = deployment?.region;
  const environment = deployment?.environment;
  const deploymentId = deployment?.deployment_id;
  const byResource = groupBy === RESOURCE;

  const {
    value: cost,
    loading: costLoading,
    error: costError,
  } = useAsync(async (): Promise<DeploymentCostResult | null> => {
    if (byResource) return null;
    const query = costQueryString({ granularity, periods, group_by: groupBy, metric });
    return fetchJson(
      config,
      `cost/${projectId}/${region}/${encodeURIComponent(environment ?? '')}/${encodeURIComponent(
        deploymentId ?? '',
      )}?${query}`,
    );
  }, [config, projectId, region, environment, deploymentId, granularity, periods, groupBy, metric]);

  const {
    value: resources,
    loading: resourcesLoading,
    error: resourcesError,
  } = useAsync(async (): Promise<ResourceCosts | null> => {
    if (!byResource || !deploymentId) return null;
    const query = costQueryString({
      days: resourceDays,
      metric,
      deployment_ids: [deploymentId],
    });
    return fetchJson(config, `cost_resources/${projectId}/${region}?${query}`);
  }, [config, projectId, region, deploymentId, byResource, resourceDays, metric]);

  const view = useMemo(() => {
    if (!cost) return undefined;
    const labels = topCostLabels(cost, colors.series.length);
    const { assigned, remembered } = assignSeriesSlots(labels, slotMemory.current);
    slotMemory.current = remembered;
    // Stacked in slot order, so the colours that meet are the pairs the palette was validated for.
    const ordered = [...labels].sort((a, b) => assigned.get(a)! - assigned.get(b)!);
    const chart = buildCostChart(cost, ordered);
    const colorOf = (label: string) =>
      label === OTHER_LABEL || !assigned.has(label)
        ? colors.other
        : colors.series[assigned.get(label)!];
    return { chart, colorOf };
  }, [cost, colors]);

  const handleGranularity = (_: unknown, next: CostGranularity | null) => {
    if (!next) return;
    setGranularity(next);
    setPeriods(DEFAULT_COST_PERIODS[next]);
  };

  const loading = byResource ? resourcesLoading : costLoading;
  const error = byResource ? resourcesError : costError;
  const hasData = byResource ? !!resources : !!cost;

  return (
    <InfoCard title="Cost" subheader={`Resources tagged ${COST_TAG} = ${deploymentId ?? ''}`}>
      <Box display="flex" flexWrap="wrap" gap={1.5} alignItems="center" mb={2}>
        {!byResource && (
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
        )}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="cost-range-label">Range</InputLabel>
          {byResource ? (
            <Select
              labelId="cost-range-label"
              label="Range"
              value={resourceDays}
              onChange={(e) => setResourceDays(Number(e.target.value))}
            >
              {RESOURCE_DAYS.map((r) => (
                <MenuItem key={r.days} value={r.days}>
                  {r.label}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Select
              labelId="cost-range-label"
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
          )}
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="cost-group-label">Group by</InputLabel>
          <Select
            labelId="cost-group-label"
            label="Group by"
            value={groupBy}
            onChange={(e) => setGroupBy(String(e.target.value))}
          >
            {GROUP_BY_OPTIONS.map((d) => (
              <MenuItem key={d.value} value={d.value}>
                {d.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <CostMetricToggle value={metric} onChange={setMetric} />
        {loading && hasData && <CircularProgress size={16} />}
      </Box>

      {error ? (
        <Alert severity="warning">
          {error.message}
          {byResource &&
            ' Resource costs need resource-level data enabled in the Cost Explorer settings of the management account.'}
        </Alert>
      ) : !hasData ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={24} />
        </Box>
      ) : byResource && resources ? (
        <ResourceBreakdown resources={resources} days={resourceDays} />
      ) : (
        cost &&
        view && (
          <DimensionBreakdown
            cost={cost}
            view={view}
            rangeLabel={COST_RANGES[granularity].find((r) => r.periods === periods)?.label ?? ''}
            heading={COST_DIMENSIONS.find((d) => d.value === groupBy)?.label ?? groupBy}
            barStroke={theme.palette.background.paper}
          />
        )
      )}
    </InfoCard>
  );
};

const EmptyCost = () => (
  <Alert severity="info">
    No cost recorded for this deployment in the selected range. Costs only show up once {COST_TAG}{' '}
    is activated as a cost allocation tag in the billing account, and can take up to 24 hours to
    appear.
  </Alert>
);

const TotalLine = ({
  total,
  unit,
  label,
  estimated,
}: {
  total: number;
  unit: string;
  label: string;
  estimated: boolean;
}) => (
  <Box display="flex" alignItems="baseline" gap={1} mb={1}>
    <Typography variant="h3" component="p">
      {formatCost(total, unit)}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {label.toLowerCase()}
      {estimated && ' · includes estimated periods'}
    </Typography>
  </Box>
);

const DimensionBreakdown = ({
  cost,
  view,
  rangeLabel,
  heading,
  barStroke,
}: {
  cost: DeploymentCostResult;
  view: {
    chart: ReturnType<typeof buildCostChart>;
    colorOf: (label: string) => string;
  };
  rangeLabel: string;
  heading: string;
  barStroke: string;
}) => {
  const unit = cost.unit ?? 'USD';
  if (cost.total === 0 && cost.groups.every((g) => g.amount === 0)) return <EmptyCost />;

  return (
    <>
      <TotalLine
        total={cost.total}
        unit={unit}
        label={rangeLabel}
        estimated={cost.periods.some((p) => p.estimated)}
      />
      <Box
        sx={{
          width: '100%',
          height: 280,
          // A surface gap between stacked segments, so neighbouring colours never touch.
          '& .MuiBarElement-root': { stroke: barStroke, strokeWidth: 2 },
        }}
      >
        <BarChart
          dataset={view.chart.rows}
          xAxis={[{ scaleType: 'band', dataKey: 'period', tickLabelInterval: 'auto' }]}
          yAxis={[
            { width: 56, valueFormatter: (v: number | null) => formatCostTick(v ?? 0, unit) },
          ]}
          series={view.chart.series.map((s) => ({
            dataKey: s.key,
            label: s.label,
            stack: 'cost',
            color: view.colorOf(s.label),
            valueFormatter: (v: number | null) => formatCost(v ?? 0, unit),
          }))}
          hideLegend={view.chart.series.length < 2}
          borderRadius={4}
          grid={{ horizontal: true }}
        />
      </Box>
      <Box mt={2}>
        <CostShareTable
          heading={heading}
          ariaLabel="Cost by dimension"
          total={cost.total}
          unit={unit}
          rows={cost.groups.map((group) => {
            const label = costGroupLabel(group.keys);
            return { key: label, label, amount: group.amount, color: view.colorOf(label) };
          })}
        />
      </Box>
    </>
  );
};

const ResourceBreakdown = ({ resources, days }: { resources: ResourceCosts; days: number }) => {
  if (resources.resources.length === 0) return <EmptyCost />;
  return (
    <>
      <TotalLine
        total={resources.total}
        unit={resources.unit}
        label={RESOURCE_DAYS.find((r) => r.days === days)?.label ?? `Last ${days} days`}
        estimated={resources.estimated}
      />
      <CostShareTable
        heading="Resource"
        ariaLabel="Cost by resource"
        total={resources.total}
        unit={resources.unit}
        maxHeight={420}
        rows={resources.resources.map((r) => ({
          key: r.resource_id,
          label: <ResourceIdLabel resourceId={r.resource_id} />,
          amount: r.amount,
        }))}
      />
    </>
  );
};
