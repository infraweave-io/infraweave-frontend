import React, { useState } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import { Popover, Typography, Stack } from '@mui/material';
import { Deployment } from '../../../types/Deployment';
import { CodeSnippet, Progress } from '../../../standalone/components/ComponentAdapter';
import { Box } from '@mui/material';
import { ChangeRecord } from '../../../types/Log';
import { useAsyncFn } from '../../../hooks/useAsync';

interface DriftPopoverProps {
  children: React.ReactNode;
  deployment: Deployment;
}

const DriftPopover: React.FC<DriftPopoverProps> = ({ children, deployment }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const config = useConfig();
  const fetchLogs = async (): Promise<ChangeRecord> => {
    console.log('Fetching change record');
    console.log('deployment', deployment);

    const encodedEnvironment = encodeURIComponent(deployment.environment);
    const encodedDeploymentId = encodeURIComponent(deployment.deployment_id);
    const encodedJobId = encodeURIComponent(deployment.job_id);
    const changeType = 'PLAN';
    const project = deployment.project_id;
    const region = deployment.region;

    try {
      const response = await config.fetch(
        config.getApiUrl(
          `api/proxy/api/infraweave/api/v1/change_record/${project}/${region}/${encodedEnvironment}/${encodedDeploymentId}/${encodedJobId}/${changeType}`,
        ),
      );
      if (response.status >= 300 && response.status < 400) {
        throw new Error('Redirected to login or guest page');
      }

      const json = await response.json();
      console.log('json', json);

      return json;
    } catch (err) {
      console.error('Error change record', err);
      throw err;
    }
  };

  const [{ value, loading, error }, fetchLogsOnOpen] = useAsyncFn(fetchLogs, [deployment]);

  const handlePopoverToggle = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!open) {
      fetchLogsOnOpen();
    }
    setAnchorEl(anchorEl ? null : event.currentTarget);
    setOpen(!open);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
    setOpen(false);
  };

  const id = open ? 'simple-popover' : undefined;

  return (
    <div>
      <Box onClick={handlePopoverToggle} sx={{ cursor: 'pointer', display: 'inline-flex' }}>
        {children}
      </Box>

      {/* Popover content */}
      {open && (
        <Popover
          id={id}
          slotProps={{
            root: {
              sx: {
                overflowY: 'scroll',
              },
            },
          }}
          open={open}
          anchorEl={anchorEl}
          onClose={handlePopoverClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          disableScrollLock // Ensure scroll is not locked
          disableRestoreFocus
        >
          <Box sx={{ p: 2, maxWidth: 720 }}>
            {loading ? (
              <Progress />
            ) : error ? (
              <Typography variant="body2" color="error">
                Error loading data
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="h5" component="h2">
                    Drift detected
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    This deployment has drifted from its desired specification.
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Checked at {value?.timestamp}
                </Typography>
                <Box>
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5 }}
                  >
                    Output
                  </Typography>
                  <CodeSnippet
                    language="text"
                    showCopyCodeButton
                    text={value?.plan_std_output || 'Could not fetch logs'}
                  />
                </Box>
              </Stack>
            )}
          </Box>
        </Popover>
      )}
    </div>
  );
};

export default DriftPopover;
