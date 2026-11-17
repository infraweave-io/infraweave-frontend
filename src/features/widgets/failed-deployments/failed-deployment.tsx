import React from 'react';
import { Alert, Box, Skeleton, Stack, Typography } from '@mui/material';
import { Link, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { ListIncomplete } from '../../../shared/components/ListIncomplete';
import { StatusChip } from '../../../shared/components/StatusChip';
import { useFleetDeployments } from '../../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { Deployment } from '../../../types/Deployment';
import { INCOMPLETE_REASON_TEXT } from '../../../utils/deploymentFetch';
import { isFailedDeployment } from '../../../utils/deploymentStatus';

/** A widget is a preview; the full list lives on the Deployments tab. */
const MAX_ROWS = 10;

/** A deployment id is only unique within its account, region and environment. */
const deploymentKey = (d: Deployment) =>
  `${d.project_id}/${d.region}/${d.environment}/${d.deployment_id}`;

const deploymentLink = (d: Deployment) =>
  `/infraweave/deployment/${d.project_id}/${d.region}/${encodeURIComponent(
    d.environment,
  )}/${encodeURIComponent(d.deployment_id)}/overview`;

const ago = (epoch: number): string => {
  const minutes = Math.max(0, Math.round((Date.now() - epoch) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

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

  if (fleet.error)
    return <ResponseErrorPanel error={fleet.error} title="Could not load accounts" />;

  if (fleet.nothingToLoad) {
    return (
      <Typography variant="body2" color="text.secondary">
        None of your accounts has a region configured, so there are no deployments to check.
      </Typography>
    );
  }

  if (!fleet.accessKnown || fleet.fetchedAt === 0) {
    // A load that failed before anything arrived would otherwise read as loading forever.
    if (fleet.loadFailed) {
      return <ResponseErrorPanel error={new Error('Deployments could not be loaded.')} />;
    }
    return (
      <Stack spacing={1} aria-busy="true" aria-label="Loading failed deployments">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={44} />
        ))}
      </Stack>
    );
  }

  const shown = failed.slice(0, MAX_ROWS);
  const hidden = failed.length - shown.length;

  return (
    <Box>
      {fleet.loadFailed && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          The last refresh failed, so this list is from {ago(fleet.fetchedAt)}.
        </Alert>
      )}

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
