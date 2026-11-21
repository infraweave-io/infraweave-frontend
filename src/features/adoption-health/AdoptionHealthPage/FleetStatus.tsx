import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  INCOMPLETE_REASON_TEXT,
  SourceProgress,
  SourceState,
} from '../../../utils/deploymentFetch';
import { FLEET_FRESH_FOR_MS } from '../../../utils/fleetCache';
import { ago } from '../../../utils/format';
import { ListIncomplete } from '../../../shared/components/ListIncomplete';
import { Deployment } from '../../../types/Deployment';
import { FleetDeployments } from './useFleetDeployments';

const STATE_ORDER: Record<SourceState, number> = { loading: 0, failed: 1, pending: 2, done: 3 };

const STATE_COLOR: Record<SourceState, 'default' | 'primary' | 'success' | 'error'> = {
  pending: 'default',
  loading: 'primary',
  done: 'success',
  failed: 'error',
};

const summarise = (sources: SourceProgress[] = []) => {
  const finished = sources.filter((s) => s.state === 'done' || s.state === 'failed').length;
  return {
    finished,
    total: sources.length,
    rows: sources.reduce((sum, s) => sum + s.rows, 0),
    requests: sources.reduce((sum, s) => sum + s.requests, 0),
    percent: sources.length > 0 ? (finished / sources.length) * 100 : 0,
  };
};

const plural = (count: number, noun: string) =>
  `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`;

/** Narrows what the status bar counts, e.g. to stack deployments on a stacks view. */
export type FleetScope = {
  deployments: Deployment[];
  /** E.g. `stack deployment` / `stack deployments`. */
  noun: { singular: string; plural: string };
};

const SourceList = ({ sources }: { sources: SourceProgress[] }) => {
  const sorted = [...sources].sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.label.localeCompare(b.label),
  );
  return (
    <Box
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 240, overflowY: 'auto', mt: 2 }}
    >
      {sorted.map((source) => (
        <Tooltip
          key={source.label}
          title={`${source.state}, ${source.rows} deployment(s), ${source.requests} request(s)`}
        >
          <Chip
            size="small"
            variant={source.state === 'pending' ? 'outlined' : 'filled'}
            color={STATE_COLOR[source.state]}
            label={source.state === 'pending' ? source.label : `${source.label}: ${source.rows}`}
          />
        </Tooltip>
      ))}
    </Box>
  );
};

const modeText = (fleet: FleetDeployments): string =>
  fleet.progress?.mode === 'per-module'
    ? 'The API has no fleet endpoint yet, so this asks module by module in every region. '
    : 'One request per region, covering every module in every account you can see. ';

const loadingProgressText = (fleet: FleetDeployments, finished: number, total: number): string => {
  if (total > 0) {
    const unit = fleet.progress?.mode === 'per-module' ? 'modules' : 'regions';
    return `${finished} of ${total} ${unit} done`;
  }
  return fleet.regions.length === 0 ? 'Finding your accounts and regions...' : 'Starting...';
};

const refreshDescription = (loading: boolean, finished: number, total: number): string =>
  loading ? `, refreshing${total > 0 ? ` (${finished}/${total})` : ''}...` : '';

const FleetProgressAndNotices = ({
  fleet,
  total,
  percent,
}: {
  fleet: FleetDeployments;
  total: number;
  percent: number;
}) => (
  <>
    {fleet.loadingDeployments && (
      <LinearProgress
        variant={total > 0 ? 'determinate' : 'indeterminate'}
        value={percent}
        aria-label="Fleet refresh progress"
        sx={{ mt: 1, height: 3 }}
      />
    )}
    {fleet.loadFailed && (
      <Alert severity="warning" sx={{ mt: 2 }}>
        The last refresh failed, so these numbers are from {ago(fleet.fetchedAt)}.
      </Alert>
    )}
    {/* A reload within a minute draws the same short fleet from the cache, so point at
        Refresh, which always asks again. */}
    {fleet.incomplete && (
      <ListIncomplete
        label="deployments"
        reason={INCOMPLETE_REASON_TEXT[fleet.incomplete]}
        retry="Use Refresh to try again."
      />
    )}
    {fleet.catalogueIncomplete && (
      <ListIncomplete
        label="the module and stack list"
        reason="did not finish, so modules and stacks with no deployments may be missing"
      />
    )}
  </>
);

/** Shown instead of a view until the first fleet has loaded. */
export const FleetLoadingScreen = ({ fleet }: { fleet: FleetDeployments }) => {
  const { finished, total, rows, requests, percent } = summarise(fleet.progress?.sources);

  if (fleet.nothingToLoad) {
    return (
      <Alert severity="info">
        None of the accounts you can see has a region configured, so there are no deployments to
        show.
      </Alert>
    );
  }

  if (fleet.loadFailed) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={fleet.refresh}>
            Retry
          </Button>
        }
      >
        Could not load the deployments behind this view.
      </Alert>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Loading the fleet overview
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {modeText(fleet)}
        Once loaded it is cached, so switching views is instant. It refreshes in the background once
        older than {FLEET_FRESH_FOR_MS / 60000} minutes.
      </Typography>

      <LinearProgress
        variant={total > 0 ? 'determinate' : 'indeterminate'}
        value={percent}
        aria-label="Fleet loading progress"
        sx={{ height: 8, borderRadius: 4 }}
      />
      <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
        <Typography variant="body2">{loadingProgressText(fleet, finished, total)}</Typography>
        <Typography variant="body2" color="text.secondary">
          {rows} deployments so far
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {requests} requests
        </Typography>
      </Stack>

      {fleet.progress?.sources && <SourceList sources={fleet.progress.sources} />}
    </Paper>
  );
};

/** Above a view once a fleet has loaded: its age, a refresh, and anything missing from it. */
export const FleetStatusBar = ({
  fleet,
  scope,
}: {
  fleet: FleetDeployments;
  scope?: FleetScope;
}) => {
  const { finished, total, percent } = summarise(fleet.progress?.sources);
  const counted = scope?.deployments ?? fleet.deployments;
  const accounts = React.useMemo(() => new Set(counted.map((d) => d.project_id)).size, [counted]);
  const noun = scope?.noun ?? { singular: 'deployment', plural: 'deployments' };
  const countedNoun = counted.length === 1 ? noun.singular : noun.plural;

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          {counted.length.toLocaleString()} {countedNoun} across {plural(accounts, 'account')},
          updated {ago(fleet.fetchedAt)}
          {refreshDescription(fleet.loadingDeployments, finished, total)}
        </Typography>
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fleet.refresh}
          disabled={fleet.loadingDeployments}
        >
          Refresh
        </Button>
      </Box>
      <FleetProgressAndNotices fleet={fleet} total={total} percent={percent} />
    </Box>
  );
};

export const FleetGate = ({
  fleet,
  scope,
  children,
}: {
  fleet: FleetDeployments;
  scope?: FleetScope;
  children: React.ReactNode;
}) =>
  // nothingToLoad first: a fleet cached before the accounts lost their regions is not theirs.
  fleet.nothingToLoad || fleet.fetchedAt === 0 || !fleet.accessKnown ? (
    <FleetLoadingScreen fleet={fleet} />
  ) : (
    <>
      <FleetStatusBar fleet={fleet} scope={scope} />
      {children}
    </>
  );
