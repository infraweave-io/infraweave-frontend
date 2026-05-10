import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Typography, Box, Button, Chip, IconButton, Drawer } from '@mui/material';
import Close from '@mui/icons-material/Close';
import { useConfig } from '../../../hooks/useConfig';
import { Event } from '../../../types/Event';
import { Deployment } from '../../../types/Deployment';
import { ChangeRecord } from '../../../types/Log';
import { Logs } from './Logs';
import { ChangesPlan } from './ChangesPlan';
import { DeploymentIdBadge, EnvironmentBadge } from '../../../shared/components/DeploymentBadges';

export const ReadLogsButton = (
  {
    event,
    deployment,
    autoFetch,
    jobStatus,
  }: {
    event?: Event;
    deployment?: Deployment;
    autoFetch?: boolean;
    jobStatus?: string;
  } = {
    event: undefined,
  },
) => {
  const [isOpen, toggleDrawer] = useState(false);
  const [logs, setLogs] = useState(false);

  // const isSuccessful = (jobStatus || event?.status) === 'successful';

  return (
    <>
      <ChangeSummaryButton
        event={event}
        deployment={deployment}
        autoFetch={autoFetch}
        jobStatus={jobStatus}
        onClick={() => {
          setLogs(false);
          toggleDrawer(true);
        }}
      />
      <Box mt={1} />
      <Button
        variant="contained"
        color="primary"
        onClick={() => {
          setLogs(true);
          toggleDrawer(true);
        }}
      >
        Read Logs
      </Button>
      <Drawer
        PaperProps={{
          sx: {
            width: '70%',
            display: 'flex',
            flexDirection: 'column',
            p: 2.5,
            pt: 10,
            height: '100vh',
            overflow: 'hidden',
          },
        }}
        anchor="right"
        open={isOpen}
        onClose={() => toggleDrawer(false)}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
      >
        <DrawerContent
          toggleDrawer={toggleDrawer}
          event={event}
          deployment={deployment}
          viewLogs={logs}
          jobStatus={jobStatus}
        />
      </Drawer>
    </>
  );
};

export const DrawerContent = ({
  toggleDrawer,
  event,
  deployment,
  viewLogs,
  jobStatus,
}: {
  toggleDrawer: (isOpen: boolean) => void;
  event?: Event;
  deployment?: Deployment;
  viewLogs: boolean;
  jobStatus?: string;
}) => {
  const status = jobStatus || event?.status;
  const config = useConfig();
  const theme = useTheme();

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexShrink: 0,
        }}
      >
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
            <Typography variant="h5">{viewLogs ? 'Logs' : 'Resource Changes'}</Typography>
            <EnvironmentBadge value={deployment?.environment} showPrefix />
            <DeploymentIdBadge value={event?.deployment_id} showPrefix />
            {status && (
              <Chip
                label={status.toUpperCase()}
                color={
                  status.toLowerCase() === 'successful'
                    ? 'success'
                    : ['failed', 'error'].includes(status.toLowerCase())
                      ? 'error'
                      : 'default'
                }
                size="small"
                variant="outlined"
              />
            )}
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Viewing job {event?.job_id}
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          {!viewLogs && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                const width = window.screen.availWidth;
                const height = window.screen.availHeight;

                const encodedEnvironment = encodeURIComponent(deployment?.environment ?? '');
                const encodedJobId = encodeURIComponent(event?.job_id ?? '');
                const encodedDeploymentId = encodeURIComponent(deployment?.deployment_id ?? '');
                const changeType = event?.event?.toUpperCase() ?? 'UNKNOWN';

                // Using config.getApiUrl() instead of backendBaseUrl
                const graphUrl = config.getApiUrl(
                  `api/proxy/api/infraweave/api/v1/change_record_graph/${deployment?.project_id}/${deployment?.region}/${encodedEnvironment}/${encodedDeploymentId}/${encodedJobId}/${changeType}`,
                );

                const params = new URLSearchParams({
                  file: graphUrl,
                  theme: theme.palette.mode,
                });
                window.open(
                  `/graph?${params.toString()}`,
                  'InfraWeaveGraph',
                  `popup=yes,width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`,
                );
              }}
            >
              Graph
            </Button>
          )}
          <IconButton
            key="dismiss"
            title="Close the drawer"
            onClick={() => toggleDrawer(false)}
            color="inherit"
          >
            <Close sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </Box>
      <Box sx={{ flexGrow: 1, overflow: 'auto', bgcolor: 'background.default' }}>
        {viewLogs ? (
          <Logs event={event} deployment={deployment} />
        ) : (
          <ChangesPlan event={event} deployment={deployment} />
        )}
      </Box>
    </>
  );
};

const ChangeSummaryButton = ({
  event,
  deployment,
  onClick,
  autoFetch = false,
  jobStatus,
}: {
  event?: Event;
  deployment?: Deployment;
  onClick: () => void;
  autoFetch?: boolean;
  jobStatus?: string;
}) => {
  const config = useConfig();
  const [summary, setSummary] = useState<string | null>(null);
  const [resourceDiff, setResourceDiff] = useState<{
    added: number;
    changed: number;
    destroyed: number;
  } | null>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!autoFetch) return;

    let active = true;

    const fetchSummary = async () => {
      if (!event || !deployment) return;

      const encodedEnvironment = encodeURIComponent(deployment.environment ?? '');
      const encodedJobId = encodeURIComponent(event.job_id ?? '');
      const encodedDeploymentId = encodeURIComponent(event.deployment_id ?? '');
      const changeType = event.event?.toUpperCase() ?? 'UNKNOWN';
      const project = deployment.project_id;
      const region = deployment.region;

      try {
        // Using config.getApiUrl() instead of backendBaseUrl
        const response = await config.fetch(
          config.getApiUrl(
            `api/proxy/api/infraweave/api/v1/change_record/${project}/${region}/${encodedEnvironment}/${encodedDeploymentId}/${encodedJobId}/${changeType}`,
          ),
        );

        if (response.ok) {
          const json: ChangeRecord = await response.json();
          if (!active) return;

          if (json.resource_changes && json.resource_changes.length > 0) {
            const added = json.resource_changes.filter((r) => r.action === 'create').length;
            const changed = json.resource_changes.filter((r) => r.action === 'update').length;
            const destroyed = json.resource_changes.filter((r) => r.action === 'delete').length;
            // Also counting replacements if any
            const replaced = json.resource_changes.filter((r) => r.action === 'replace').length;

            if (added + changed + destroyed + replaced > 0) {
              const totalAdded = added + replaced;
              const totalChanged = changed;
              const totalDestroyed = destroyed + replaced;
              setSummary(`Resources: +${totalAdded} ~${totalChanged} -${totalDestroyed}`);
              setResourceDiff({
                added: totalAdded,
                changed: totalChanged,
                destroyed: totalDestroyed,
              });
            } else {
              setSummary('No resource changes');
              setResourceDiff(null);
            }
          } else if (json.plan_std_output) {
            const match = json.plan_std_output.match(
              /Plan: (\d+) to add, (\d+) to change, (\d+) to destroy./,
            );
            if (match) {
              const added = parseInt(match[1], 10);
              const changed = parseInt(match[2], 10);
              const destroyed = parseInt(match[3], 10);
              setSummary(`Resources: +${added} ~${changed} -${destroyed}`);
              setResourceDiff({ added, changed, destroyed });
            } else if (json.plan_std_output.includes('No changes. Infrastructure is up-to-date.')) {
              setSummary('No changes');
              setResourceDiff(null);
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch change summary', e);
      }
    };

    fetchSummary();
    return () => {
      active = false;
    };
  }, [event, deployment, config, autoFetch]);

  const isSuccessful = (jobStatus || event?.status)?.toLowerCase() === 'successful';
  const _isFailed = (jobStatus || event?.status)?.toLowerCase() === 'failed';

  return (
    <Button
      variant={summary ? 'outlined' : 'contained'}
      color={summary ? 'primary' : 'secondary'}
      onClick={onClick}
      style={{ whiteSpace: 'nowrap' }}
      title={summary ?? 'View Changes'}
      sx={
        !isSuccessful
          ? {
              ...(summary
                ? {
                    borderColor: theme.palette.grey[500],
                    color: theme.palette.text.secondary,
                  }
                : {
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? theme.palette.grey[700]
                        : theme.palette.grey[300],
                    color: theme.palette.getContrastText(
                      theme.palette.mode === 'dark'
                        ? theme.palette.grey[700]
                        : theme.palette.grey[300],
                    ),
                    boxShadow: 'none',
                    '&:hover': {
                      backgroundColor:
                        theme.palette.mode === 'dark'
                          ? theme.palette.grey[600]
                          : theme.palette.grey[400],
                    },
                  }),
            }
          : {}
      }
    >
      {resourceDiff ? (
        <Box component="span" display="flex" gap={0.5}>
          <span>Resources:</span>
          <span style={{ color: theme.palette.success.main }}>+{resourceDiff.added}</span>
          <span style={{ color: theme.palette.warning.main }}>~{resourceDiff.changed}</span>
          <span style={{ color: theme.palette.error.main }}>-{resourceDiff.destroyed}</span>
        </Box>
      ) : (
        summary || 'View Changes'
      )}
    </Button>
  );
};
