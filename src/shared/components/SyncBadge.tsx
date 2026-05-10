import { Deployment } from '../../types/Deployment';
import { Box, Chip } from '@mui/material';
import DriftPopover from '../../features/deployments/list/DriftPopOver';
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
    return (
      <Chip
        label={`Disabled (${timeSinceSyncMinutes}m ago)`}
        style={{ marginLeft: '8px', color: 'white', backgroundColor: 'orange' }}
      />
    );
  }

  if (deployment.status === 'initiated') {
    return (
      <Chip
        label={`Syncing (${timeSinceSyncMinutes}m ago)`}
        style={{ marginLeft: '8px', color: 'white', backgroundColor: '#2E86C1' }}
      />
    );
  }

  return (
    (deployment.has_drifted && (
      <Box display="flex" alignItems="center">
        <DriftPopover deployment={deployment}>
          <Chip
            label="Has drifted"
            style={{ marginLeft: '8px', color: 'white', backgroundColor: 'purple' }}
          />
        </DriftPopover>
      </Box>
    )) ||
    (!deployment.has_drifted && (
      <Chip
        label={`In sync (${timeSinceSyncMinutes}m ago)`}
        style={{ marginLeft: '8px', color: 'white', backgroundColor: 'green' }}
      />
    ))
  );
}
