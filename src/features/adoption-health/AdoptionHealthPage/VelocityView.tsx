import React, { useState, useEffect } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import {
  Progress,
  ResponseErrorPanel,
  InfoCard,
} from '../../../standalone/components/ComponentAdapter';
import {
  Box,
  Typography,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useChartStatusColors } from '../../../contexts/ThemeContext';
import { LineChart } from '@mui/x-charts/LineChart';
import type { Event } from '../../../types/Event';
import { statusKind } from '../../../utils/deploymentStatus';
import { mapWithConcurrency } from '../../../utils/deploymentFetch';
import { useFleetDeployments } from './useFleetDeployments';
import { FleetGate } from './FleetStatus';

/** Max concurrent events requests, same limit as the fleet fetch. */
const MAX_CONCURRENT_EVENT_REQUESTS = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A `YYYY-MM-DD` UTC day, as the events are grouped, in the viewer's locale. */
const formatDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

export const VelocityView = ({ onBack }: { onBack: () => void }) => {
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
                xAxis={[
                  {
                    scaleType: 'point',
                    dataKey: 'date',
                    label: 'Date',
                    valueFormatter: formatDay,
                  },
                ]}
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
