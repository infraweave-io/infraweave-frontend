import { Deployment } from '../../types/Deployment';
import { Box } from '@mui/material';
import DriftPopover from '../../features/deployments/list/DriftPopOver';
import { StatusChip } from './StatusChip';
import React from 'react';

export default function SyncBadge({
  deployment,
  disabled = false,
}: {
  deployment: Deployment;
  disabled: boolean;
}) {
  // Calculate time since last sync
  const current_time_epoch = new Date().getTime();
  const timeSinceSync = current_time_epoch - deployment.epoch;
  // Convert to minutes
  const timeSinceSyncMinutes = Math.floor(timeSinceSync / 60000);

  if (disabled) {
    return <StatusChip tone="neutral" label={`Disabled (${timeSinceSyncMinutes}m ago)`} />;
  }

  if (deployment.status === 'initiated') {
    return <StatusChip tone="info" label={`Syncing (${timeSinceSyncMinutes}m ago)`} />;
  }

  return (
    (deployment.has_drifted && (
      <Box display="flex" alignItems="center">
        <DriftPopover deployment={deployment}>
          {/* Drift is a deviation to investigate, so it reads as a warning
              rather than the previous purple, which mapped to nothing. */}
          <StatusChip tone="warning" label="Has drifted" />
        </DriftPopover>
      </Box>
    )) ||
    (!deployment.has_drifted && (
      <StatusChip tone="success" label={`In sync (${timeSinceSyncMinutes}m ago)`} />
    ))
  );
}
