import React from 'react';
import { Alert, Box, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { Link, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { ListIncomplete } from '../../../shared/components/ListIncomplete';
import { useChartStatusColors } from '../../../contexts/ThemeContext';
import { useFleetDeployments } from '../../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { INCOMPLETE_REASON_TEXT } from '../../../utils/deploymentFetch';
import { isFailedDeployment, StatusKind, statusKind } from '../../../utils/deploymentStatus';

/** Bar and legend order: the outcome that matters most first. */
const KINDS: StatusKind[] = ['failed', 'success', 'in-progress', 'unknown'];

const KIND_LABEL: Record<StatusKind, string> = {
  failed: 'Failed',
  success: 'Successful',
  'in-progress': 'In progress',
  unknown: 'Unknown',
};

/** Keeps a single deployment in a large fleet visible; exact values are in the legend. */
const MIN_SEGMENT_PX = 4;

const percent = (count: number, total: number) =>
  total === 0 ? 0 : Math.round((count / total) * 100);

const ago = (epoch: number): string => {
  const minutes = Math.max(0, Math.round((Date.now() - epoch) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

/**
 * Share of deployments in each state, across every account the user can see. Reads the
 * shared fleet cache, so the numbers match Adoption & Health and the Failed deployments widget.
 */
export const DeploymentHealthSummary = () => {
  const fleet = useFleetDeployments();
  const colors = useChartStatusColors();

  const counts = React.useMemo(() => {
    const result: Record<StatusKind, number> = {
      failed: 0,
      success: 0,
      'in-progress': 0,
      unknown: 0,
    };
    for (const d of fleet.deployments) {
      // isFailedDeployment also counts error text, so this agrees with the failed list.
      result[isFailedDeployment(d) ? 'failed' : statusKind(d.status)] += 1;
    }
    return result;
  }, [fleet.deployments]);

  const colorByKind: Record<StatusKind, string> = {
    failed: colors.failed,
    success: colors.success,
    'in-progress': colors.inProgress,
    unknown: colors.unknown,
  };

  if (fleet.error) {
    return <ResponseErrorPanel error={fleet.error} title="Could not load accounts" />;
  }

  if (fleet.nothingToLoad) {
    return (
      <Typography variant="body2" color="text.secondary">
        None of your accounts has a region configured, so there are no deployments to check.
      </Typography>
    );
  }

  if (!fleet.accessKnown || fleet.fetchedAt === 0) {
    if (fleet.loadFailed) {
      return <ResponseErrorPanel error={new Error('Deployments could not be loaded.')} />;
    }
    return (
      <Stack spacing={1.5} aria-busy="true" aria-label="Loading deployment health">
        <Skeleton variant="rounded" width={120} height={56} />
        <Skeleton variant="rounded" height={12} />
        <Skeleton variant="rounded" height={64} />
      </Stack>
    );
  }

  const total = fleet.deployments.length;

  if (total === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No deployments in your accounts yet.
      </Typography>
    );
  }

  const present = KINDS.filter((kind) => counts[kind] > 0);
  const summary = present
    .map((kind) => `${KIND_LABEL[kind]} ${counts[kind]} (${percent(counts[kind], total)}%)`)
    .join(', ');

  return (
    <Box>
      {fleet.loadFailed && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          The last refresh failed, so these numbers are from {ago(fleet.fetchedAt)}.
        </Alert>
      )}

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
        <Typography component="span" sx={{ fontSize: '3rem', fontWeight: 600, lineHeight: 1 }}>
          {percent(counts.success, total)}%
        </Typography>
        <Typography component="span" variant="body2" color="text.secondary">
          of {total} deployments successful
        </Typography>
      </Box>

      {/* Segments are separated by a 2px gap in the card colour rather than a stroke. */}
      <Box
        role="img"
        aria-label={`Deployments by status: ${summary}`}
        sx={{ display: 'flex', gap: '2px', height: 12, mb: 1.5 }}
      >
        {present.map((kind, i) => (
          <Tooltip
            key={kind}
            title={`${KIND_LABEL[kind]}: ${counts[kind]} (${percent(counts[kind], total)}%)`}
            placement="top"
            arrow
          >
            <Box
              sx={{
                flexGrow: counts[kind],
                flexBasis: 0,
                minWidth: MIN_SEGMENT_PX,
                bgcolor: colorByKind[kind],
                borderTopLeftRadius: i === 0 ? 4 : 0,
                borderBottomLeftRadius: i === 0 ? 4 : 0,
                borderTopRightRadius: i === present.length - 1 ? 4 : 0,
                borderBottomRightRadius: i === present.length - 1 ? 4 : 0,
                cursor: 'default',
              }}
            />
          </Tooltip>
        ))}
      </Box>

      {/* The legend doubles as the table view: every value is readable without hovering. */}
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          p: 0,
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 0.75,
        }}
      >
        {KINDS.map((kind) => (
          <Box
            component="li"
            key={kind}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: colorByKind[kind],
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>
              {KIND_LABEL[kind]}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {counts[kind]}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
        Updated {ago(fleet.fetchedAt)} ·{' '}
        <Link to="/infraweave/adoption-health/health">Open deployment health</Link>
      </Typography>

      {fleet.incomplete && (
        <ListIncomplete
          label="deployments"
          reason={INCOMPLETE_REASON_TEXT[fleet.incomplete]}
          retry="It will retry on the next refresh."
        />
      )}
    </Box>
  );
};
