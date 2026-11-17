import React from 'react';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { Link } from '../../../standalone/components/ComponentAdapter';
import { StatusChip } from '../../../shared/components/StatusChip';
import { useFleetDeployments } from '../../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { isFailedDeployment } from '../../../utils/deploymentStatus';
import { deploymentKey, deploymentLink } from '../../../utils/deploymentLink';
import { ago } from '../../../utils/format';
import { FleetGate } from '../FleetGate';

/** A widget is a preview; the full list lives on the Deployments tab. */
const MAX_ROWS = 10;

/**
 * Failing deployments across every account the user can see, newest first. Reads the shared
 * fleet cache, so it agrees with Adoption & Health and adds no fetching of its own.
 */
export const FailedDeploymentsList = () => {
  const fleet = useFleetDeployments();

  const failed = React.useMemo(
    () => fleet.deployments.filter(isFailedDeployment).sort((a, b) => b.epoch - a.epoch),
    [fleet.deployments],
  );

  const shown = failed.slice(0, MAX_ROWS);
  const hidden = failed.length - shown.length;

  return (
    <FleetGate
      fleet={fleet}
      skeleton={
        <Stack spacing={1} aria-busy="true" aria-label="Loading failed deployments">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={44} />
          ))}
        </Stack>
      }
    >
      {failed.length === 0 ? (
        // Good news, but only as fresh as the last check, so say when that was.
        <Typography variant="body2" color="text.secondary">
          No failed deployments. Checked {ago(fleet.fetchedAt)}.
        </Typography>
      ) : (
        <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
          {shown.map((d) => (
            <Box
              key={deploymentKey(d)}
              sx={{ py: 1, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}
            >
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                  <Link to={deploymentLink(d)}>{d.deployment_id}</Link>
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {d.module} · {fleet.projectNames[d.project_id] ?? d.project_id} · {d.region} ·{' '}
                  {d.environment}
                </Typography>
              </Box>
              <StatusChip tone="error" label={d.status || 'error'} title={d.error_text} />
              {d.epoch > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {ago(d.epoch)}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {hidden > 0 && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
          and {hidden} more on the <Link to="/infraweave/deployments">Deployments tab</Link>
        </Typography>
      )}
    </FleetGate>
  );
};
