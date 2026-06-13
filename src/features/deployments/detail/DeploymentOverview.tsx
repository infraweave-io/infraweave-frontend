import React, { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Typography,
  Box,
  Button,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import ErrorIcon from '@mui/icons-material/Error';
import Close from '@mui/icons-material/Close';
import {
  InfoCard,
  Link,
  StructuredMetadataTable,
} from '../../../standalone/components/ComponentAdapter';
import { StatusError, StatusOK } from '../../../standalone/components/ComponentAdapter';
import { Deployment } from '../../../types/Deployment';
import { StatusSymbol } from '../../../shared/components/StatusSymbol';
import SyncBadge from '../../../shared/components/SyncBadge';
import { DeploymentIdBadge, EnvironmentBadge } from '../../../shared/components/DeploymentBadges';
import { InputsOutputs } from './InputsOutputs';
import { RecentEvents } from './Events';
import PopoverExample from './PopOver';
import { useConfig } from '../../../hooks/useConfig';

interface DeploymentOverviewProps {
  deployment?: Deployment;
  project?: string;
  region?: string;
}

export const DeploymentOverview: React.FC<DeploymentOverviewProps> = ({
  deployment,
  project,
  region,
}) => {
  const theme = useTheme();
  const config = useConfig();
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);
  const [reapplying, setReapplying] = useState(false);
  const [reapplyRequested, setReapplyRequested] = useState(false);
  const [reapplyResult, setReapplyResult] = useState<'success' | 'error' | null>(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  const statusLower = deployment?.status?.toLowerCase() ?? '';
  const isFailed = statusLower.includes('fail') || statusLower.includes('error');

  const handleReapply = async () => {
    setReapplying(true);
    setReapplyRequested(true);
    setReapplyResult(null);
    try {
      const response = await config.fetch(
        config.getApiUrl(`api/proxy/api/infraweave/api/v1/reapply`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: project,
            region,
            environment: deployment?.environment,
            deployment_id: deployment?.deployment_id,
          }),
        },
      );
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      setReapplyResult('success');
    } catch {
      setReapplyResult('error');
    } finally {
      setReapplying(false);
    }
  };

  const encodedModuleName = encodeURIComponent(deployment?.module ?? '');
  const encodedModuleVersion = encodeURIComponent(deployment?.module_version ?? '');
  const module_type = deployment?.module_type;
  const module_link = `/infraweave/${module_type}/${deployment?.module_track}/${encodedModuleName}/${encodedModuleVersion}`;

  const handleViewGraph = () => {
    const width = window.screen.availWidth;
    const height = window.screen.availHeight;
    const graphUrl = `/api/proxy/api/infraweave/api/v1/deployment_graph/${project}/${region}/${deployment?.environment}/${deployment?.deployment_id}?job_id=${deployment?.job_id}&type=STATE`;
    const params = new URLSearchParams({
      file: graphUrl,
      theme: theme.palette.mode,
    });
    window.open(
      `/graph?${params.toString()}`,
      'InfraWeaveGraph',
      `popup=yes,width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`,
    );
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-start',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        {/* Left side (40%) - Deployment Info */}
        <div style={{ flexBasis: '40%', flexShrink: 0 }}>
          <InfoCard
            title={
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <span>Deployment Information</span>
                <Box display="flex" gap={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={!!deployment?.deleted || reapplying || reapplyRequested}
                    onClick={handleReapply}
                    startIcon={
                      reapplying ? (
                        <CircularProgress size={12} color="inherit" />
                      ) : (
                        <ReplayIcon sx={{ fontSize: 14 }} />
                      )
                    }
                    sx={{
                      borderColor: 'grey.500',
                      color: 'text.primary',
                      textTransform: 'none',
                      height: '24px',
                    }}
                  >
                    {reapplying ? 'Reapplying…' : 'Reapply'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={!!deployment?.deleted}
                    onClick={handleViewGraph}
                    sx={{
                      borderColor: 'grey.500',
                      color: 'text.primary',
                      textTransform: 'none',
                      height: '24px',
                    }}
                  >
                    Graph
                  </Button>
                  <Chip
                    label={showDetailedInfo ? 'Minimal' : 'Detailed'}
                    size="small"
                    onClick={() => setShowDetailedInfo(!showDetailedInfo)}
                    sx={{ cursor: 'pointer' }}
                  />
                </Box>
              </Box>
            }
          >
            <StructuredMetadataTable
              metadata={{
                Name: deployment?.deployment_id.split('/').pop(),
                Namespace:
                  deployment?.environment.split('/').slice(1).join('/') || deployment?.environment,
                [deployment?.module_type as string]: deployment?.module,
                Version: <Link to={module_link}>{deployment?.module_version}</Link>,
                Region: deployment?.region,
                Resources: (
                  <Typography variant="body2">
                    {deployment?.tf_resources?.length || 0} resources
                  </Typography>
                ),
                Status: (
                  <Box display="flex" alignItems="center" gap={0.5}>
                    {!isFailed && <StatusSymbol status={deployment?.status ?? ''} />}
                    {isFailed ? (
                      <Box
                        component="button"
                        onClick={() => setErrorModalOpen(true)}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          background: 'none',
                          border: 'none',
                          p: 0,
                          cursor: 'pointer',
                          color: 'error.main',
                          font: 'inherit',
                          '&:hover': { opacity: 0.75 },
                        }}
                      >
                        <ErrorIcon sx={{ fontSize: 14 }} />
                        <Typography
                          variant="body2"
                          sx={{ color: 'inherit', textDecoration: 'underline', fontWeight: 500 }}
                        >
                          {deployment?.status}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2">
                        {deployment?.status ?? 'Empty status'}
                      </Typography>
                    )}
                  </Box>
                ),
                ...(showDetailedInfo && {
                  'Drift detection': deployment && (
                    <SyncBadge
                      deployment={deployment}
                      disabled={!deployment?.drift_detection?.enabled}
                    />
                  ),
                }),
                ...(showDetailedInfo &&
                  deployment?.drift_detection?.enabled && {
                    'Driftcheck interval': deployment.drift_detection.interval,
                  }),
                ...(showDetailedInfo &&
                  deployment?.drift_detection?.enabled && {
                    'Next driftcheck': deployment?.next_drift_check_epoch
                      ? new Date(deployment.next_drift_check_epoch).toLocaleString()
                      : 'Not available',
                  }),
                ...(showDetailedInfo &&
                  deployment?.drift_detection?.enabled && {
                    'Auto-remediate drift': deployment?.drift_detection.auto_remediate
                      ? 'Yes'
                      : 'No',
                  }),
                ...(showDetailedInfo && {
                  'Status Description': deployment?.error_text,
                }),
                ...(showDetailedInfo && {
                  'Deployment Id': <DeploymentIdBadge value={deployment?.deployment_id} />,
                }),
                ...(showDetailedInfo && {
                  Environment: <EnvironmentBadge value={deployment?.environment} />,
                }),
                ...(showDetailedInfo && {
                  'Initiated by': deployment?.initiated_by,
                }),
                'Last event': deployment?.epoch
                  ? new Date(deployment.epoch).toLocaleString()
                  : 'Not available',
                ...(showDetailedInfo && {
                  Reference: deployment?.reference?.startsWith('http') ? (
                    <Link to={deployment.reference} target="_blank">
                      {deployment.reference}
                    </Link>
                  ) : deployment?.reference ? (
                    <Link to="#">{deployment.reference}</Link>
                  ) : (
                    'N/A'
                  ),
                }),
                ...(showDetailedInfo && {
                  'Policy Evaluations': deployment?.policy_results?.map((p) => (
                    <PopoverExample key={p.policy} policyResult={p}>
                      <Box display="flex" alignItems="center">
                        {p.failed ? <StatusError /> : <StatusOK />}
                        <Typography variant="body2">{p.policy}</Typography>
                      </Box>
                    </PopoverExample>
                  )) || <Typography variant="body2">No policy evaluations</Typography>,
                }),
              }}
            />
          </InfoCard>
        </div>

        {/* Right side (60%) - Variables and Outputs */}
        <div
          style={{
            flexBasis: '60%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <InputsOutputs deployment={deployment} />
        </div>
      </div>

      <Box marginTop={3}>
        <RecentEvents deployment={deployment} />
      </Box>
      <Snackbar
        open={reapplyResult !== null}
        autoHideDuration={4000}
        onClose={() => setReapplyResult(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ position: 'fixed', zIndex: (theme) => theme.zIndex.snackbar + 1 }}
      >
        <Alert
          severity={reapplyResult === 'success' ? 'success' : 'error'}
          onClose={() => setReapplyResult(null)}
          variant="filled"
          sx={{ boxShadow: 3 }}
        >
          {reapplyResult === 'success'
            ? 'Reapply triggered successfully'
            : 'Failed to trigger reapply'}
        </Alert>
      </Snackbar>
      <Dialog
        open={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <ErrorIcon sx={{ color: 'error.main' }} />
              <Typography variant="h6">Job error</Typography>
            </Box>
            <IconButton onClick={() => setErrorModalOpen(false)} size="small">
              <Close />
            </IconButton>
          </Box>
          {deployment?.job_id && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
              Job: {deployment.job_id}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {deployment?.error_text && deployment.error_text.trim().length > 0 ? (
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.5,
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                bgcolor: 'background.default',
                borderRadius: 1,
                maxHeight: '60vh',
                overflow: 'auto',
              }}
            >
              {deployment.error_text}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No error details available for this deployment. Open the logs for full output.
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
