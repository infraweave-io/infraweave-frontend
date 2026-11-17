import React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { ResponseErrorPanel } from '../../standalone/components/ComponentAdapter';
import { ListIncomplete } from '../../shared/components/ListIncomplete';
import { FleetDeployments } from '../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { INCOMPLETE_REASON_TEXT } from '../../utils/deploymentFetch';
import { ago } from '../../utils/format';
import { useOnWidgetReload } from './widgetReload';

type FleetGateProps = {
  fleet: FleetDeployments;
  /** Shown until the first load arrives, shaped like the widget's own content. */
  skeleton: React.ReactNode;
  /** Also wait for the catalogue, for widgets that need the stack list to tell stacks apart. */
  waitForCatalog?: boolean;
  /** Adds "Updated X ago" below the content. */
  showUpdated?: boolean;
  /**
   * The loaded content. Only shown once the fleet has loaded, but the caller builds it on
   * every render, so it must not throw on an empty fleet.
   */
  children: React.ReactNode;
};

/**
 * The loading, error and staleness states shared by every widget that reads the fleet cache,
 * so each widget only draws its loaded content.
 */
export const FleetGate = ({
  fleet,
  skeleton,
  waitForCatalog = false,
  showUpdated = false,
  children,
}: FleetGateProps) => {
  // Every fleet widget renders through here, so this gives each one its reload button.
  useOnWidgetReload(fleet.refresh);

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

  if (!fleet.accessKnown || fleet.fetchedAt === 0 || (waitForCatalog && fleet.loadingCatalog)) {
    // A load that failed before anything arrived would otherwise read as loading forever.
    if (fleet.loadFailed) {
      return <ResponseErrorPanel error={new Error('Deployments could not be loaded.')} />;
    }
    return <>{skeleton}</>;
  }

  return (
    <Box>
      {fleet.loadFailed && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          The last refresh failed. Showing data from {ago(fleet.fetchedAt)}.
        </Alert>
      )}

      {children}

      {showUpdated && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
          Updated {ago(fleet.fetchedAt)}
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
