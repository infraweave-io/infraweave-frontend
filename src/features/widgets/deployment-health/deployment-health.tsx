import React from 'react';
import { Box, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { useChartStatusColors } from '../../../contexts/ThemeContext';
import { useFleetDeployments } from '../../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { isFailedDeployment, StatusKind, statusKind } from '../../../utils/deploymentStatus';
import { FleetGate } from '../FleetGate';

/** Bar and legend order: the outcome that matters most first. */
const KINDS: StatusKind[] = ['failed', 'success', 'running', 'unknown'];

const KIND_LABEL: Record<StatusKind, string> = {
  failed: 'Failed',
  success: 'Successful',
  running: 'In progress',
  unknown: 'Unknown',
};

/** Keeps a single deployment in a large fleet visible; exact values are in the legend. */
const MIN_SEGMENT_PX = 4;

const percent = (count: number, total: number) =>
  total === 0 ? 0 : Math.round((count / total) * 100);

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
      running: 0,
      unknown: 0,
    };
    for (const d of fleet.deployments) {
      // isFailedDeployment also counts error text, so this agrees with the failed list.
      result[isFailedDeployment(d) ? 'failed' : statusKind(d.status)] += 1;
    }
    return result;
  }, [fleet.deployments]);

  const total = fleet.deployments.length;
  const present = KINDS.filter((kind) => counts[kind] > 0);
  const summary = present
    .map((kind) => `${KIND_LABEL[kind]} ${counts[kind]} (${percent(counts[kind], total)}%)`)
    .join(', ');

  return (
    <FleetGate
      fleet={fleet}
      skeleton={
        <Stack spacing={1.5} aria-busy="true" aria-label="Loading deployment health">
          <Skeleton variant="rounded" width={120} height={56} />
          <Skeleton variant="rounded" height={12} />
          <Skeleton variant="rounded" height={64} />
        </Stack>
      }
      showUpdated
    >
      {total === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No deployments in your accounts yet.
        </Typography>
      ) : (
        <>
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
                    bgcolor: colors[kind],
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
                    bgcolor: colors[kind],
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
        </>
      )}
    </FleetGate>
  );
};
