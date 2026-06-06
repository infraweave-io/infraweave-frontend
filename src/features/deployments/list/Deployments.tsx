import React, { useState } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import { useDeployments } from '../../../hooks/useDeployments';
import {
  Table,
  TableColumn,
  Progress,
  ResponseErrorPanel,
  Link,
} from '../../../standalone/components/ComponentAdapter';
import { SimpleStepper, SimpleStepperStep } from '../../../standalone/components/ComponentAdapter';
import {
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Paper,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import Refresh from '@mui/icons-material/Refresh';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ErrorIcon from '@mui/icons-material/Error';
import Close from '@mui/icons-material/Close';
import { useAsync } from '../../../hooks/useAsync';
import { Module } from '../../../types/Module';
import UpdateIcon from '@mui/icons-material/Update';

import { Deployment, Project } from '../../../types/Deployment';
import { StatusSymbol } from '../../../shared/components/StatusSymbol';
import { VersionCell } from '../../../shared/components/VersionCell';
import SyncBadge from '../../../shared/components/SyncBadge';
import { useSelectedProjects } from '../../root/RootPage/SelectedProjectsContext';
import { DeploymentPlansModal } from './DeploymentPlansModal';
import HistoryIcon from '@mui/icons-material/History';

type DenseTableProps = {
  deployments: Deployment[];
  projects: Project[];
  onRefresh: () => void;
  dialogOpen: (open: boolean) => void;
  selectedProjectNames: string[];
  selectedRegions: string[];
  isModalOpenRef: React.MutableRefObject<boolean>;
};

// Component must be defined outside DenseTable to avoid re-creation on every render
const RemovableHeader = ({ title, onRemove }: { title: string; onRemove: () => void }) => {
  const [hover, setHover] = useState(false);

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      width="100%"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span>{title}</span>
      <Tooltip title="Hide column">
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          sx={{
            ml: 1,
            padding: 0.5,
            opacity: hover ? 0.7 : 0,
            transition: 'opacity 0.2s',
            '&:hover': {
              opacity: 1,
              color: 'text.secondary',
            },
          }}
        >
          <VisibilityOffIcon fontSize="small" sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export const DenseTable = ({
  deployments,
  projects,
  onRefresh,
  dialogOpen,
  selectedProjectNames,
  selectedRegions,
  isModalOpenRef,
}: DenseTableProps) => {
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showDriftCheck, setShowDriftCheck] = useState(false);
  const [showRegion, setShowRegion] = useState(true);
  const [showPlansModal, setShowPlansModal] = useState(false);

  const columns: TableColumn[] = [
    { title: 'Name', field: 'name' },
    { title: 'Namespace', field: 'namespace' },
    ...(showAccount
      ? [
          {
            title: (
              <RemovableHeader title="Account" onRemove={() => setShowAccount(false)} />
            ) as any,
            field: 'account',
          },
        ]
      : []),
    ...(showRegion
      ? [
          {
            title: (
              <RemovableHeader title="Region" onRemove={() => setShowRegion(false)} />
            ) as any,
            field: 'region',
          },
        ]
      : []),
    { title: 'Status', field: 'status' },
    ...(showTimestamp
      ? [
          {
            title: (
              <RemovableHeader title="Timestamp" onRemove={() => setShowTimestamp(false)} />
            ) as any,
            field: 'timestamp',
            customSort: (a: any, b: any) => (a.epoch || 0) - (b.epoch || 0),
          },
        ]
      : []),
    { title: 'Version', field: 'module_version' },
    ...(showDriftCheck
      ? [
          {
            title: (
              <RemovableHeader title="Drift check" onRemove={() => setShowDriftCheck(false)} />
            ) as any,
            field: 'has_drifted',
          },
        ]
      : []),
  ];

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [newVersion, setNewVersion] = useState('');
  const [errorModalDeployment, setErrorModalDeployment] = useState<Deployment | null>(null);

  const handleUpgrade = async () => {
    try {
      // TODO: Implement the actual merge request creation
      const url = `http://google.com`;
      window.open(url, '_blank');

      setOpenDialog(false);
      dialogOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const data = deployments.map((deployment) => {
    const encodedEnvironment = encodeURIComponent(deployment.environment ?? '');
    const encodedDeploymentId = encodeURIComponent(deployment.deployment_id ?? '');
    const project = deployment.project_id;
    const region = deployment.region;

    const deployment_link = `/infraweave/deployment/${project}/${region}/${encodedEnvironment}/${encodedDeploymentId}/overview`;

    return {
      region: deployment.region,
      name: (
        <>
          <Link to={deployment_link}>{deployment.deployment_id.split('/').pop()}</Link>
          <br />
          <span style={{ color: 'grey', marginTop: '0.5em', display: 'inline-block' }}>
            {deployment.module}
          </span>
        </>
      ),
      namespace: (
        <>
          {deployment?.environment.split('/').slice(1).join('/') || deployment?.environment}
          <br />
          <span style={{ color: 'grey', marginTop: '0.5em', display: 'inline-block' }}>
            {deployment?.environment.split('/')[0]}
          </span>
        </>
      ),
      account:
        projects.find((p) => p.project_id === deployment.project_id)?.name || deployment.project_id,
      status: (() => {
        const isFailed =
          deployment.status?.toLowerCase().startsWith('failed') ||
          deployment.status?.toLowerCase() === 'error';
        return (
          <Box display="flex" alignItems="center" gap={0.5}>
            {!isFailed && <StatusSymbol status={deployment.status} />}
            {isFailed ? (
              <Box
                component="button"
                onClick={() => setErrorModalDeployment(deployment)}
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
                  {deployment.status}
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2">{deployment.status}</Typography>
            )}
          </Box>
        );
      })(),
      timestamp: deployment.epoch ? new Date(deployment.epoch).toLocaleString() : 'N/A',
      // environment: deployment.environment,
      module_version: (
        <Box display="flex" alignItems="center">
          <Typography variant="body2">
            <VersionCell version={deployment.module_version} />
          </Typography>
          <IconButton
            size="small"
            onClick={() => {
              setSelectedDeployment(deployment);
              setNewVersion('');
              setOpenDialog(true);
              dialogOpen(true);
            }}
          >
            <UpdateIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
      has_drifted: (
        <SyncBadge deployment={deployment} disabled={!deployment?.drift_detection?.enabled} />
      ),
    };
  });

  const args = {
    activeStep: 0,
  };

  const moduleName = selectedDeployment?.module;
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  return (
    <>
      <Table
        title={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box display="flex" gap={1} alignItems="center">
              <IconButton color="primary" onClick={onRefresh} style={{ fontSize: '1.5rem' }}>
                <Refresh fontSize="small" />
              </IconButton>
            </Box>

            <Box display="flex" gap={1} ml={2} alignItems="center">
              {!showTimestamp && (
                <Tooltip title="Show Timestamp column">
                  <IconButton
                    size="small"
                    onClick={() => setShowTimestamp(true)}
                    sx={{
                      padding: 0.5,
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <VisibilityIcon fontSize="small" sx={{ fontSize: 16 }} />
                    <Typography variant="caption" sx={{ ml: 0.5 }}>
                      Timestamp
                    </Typography>
                  </IconButton>
                </Tooltip>
              )}
              {!showAccount && (
                <Tooltip title="Show Account column">
                  <IconButton
                    size="small"
                    onClick={() => setShowAccount(true)}
                    sx={{
                      padding: 0.5,
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <VisibilityIcon fontSize="small" sx={{ fontSize: 16 }} />
                    <Typography variant="caption" sx={{ ml: 0.5 }}>
                      Account
                    </Typography>
                  </IconButton>
                </Tooltip>
              )}
              {!showRegion && (
                <Tooltip title="Show Region column">
                  <IconButton
                    size="small"
                    onClick={() => setShowRegion(true)}
                    sx={{
                      padding: 0.5,
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <VisibilityIcon fontSize="small" sx={{ fontSize: 16 }} />
                    <Typography variant="caption" sx={{ ml: 0.5 }}>
                      Region
                    </Typography>
                  </IconButton>
                </Tooltip>
              )}
              {!showDriftCheck && (
                <Tooltip title="Show Drift Check column">
                  <IconButton
                    size="small"
                    onClick={() => setShowDriftCheck(true)}
                    sx={{
                      padding: 0.5,
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <VisibilityIcon fontSize="small" sx={{ fontSize: 16 }} />
                    <Typography variant="caption" sx={{ ml: 0.5 }}>
                      Drift Check
                    </Typography>
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            <Box display="flex" gap={1} ml={2} alignItems="center">
              <Autocomplete
                multiple
                limitTags={1}
                id="multiple-limit-tags"
                options={tags}
                getOptionLabel={(option) => option}
                defaultValue={selectedTags}
                renderInput={(params) => (
                  <TextField {...params} label="Tags" placeholder="" size="small" />
                )}
                onChange={(_event, newValue) => {
                  setSelectedTags(newValue.map((tag) => tag));
                }}
                sx={{ minWidth: 120 }}
              />
              <Tooltip title="View deployment plans & history">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<HistoryIcon />}
                  onClick={() => {
                    setShowPlansModal(true);
                    isModalOpenRef.current = true;
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  History
                </Button>
              </Tooltip>
            </Box>
          </div>
        }
        options={{
          search: true,
          paging: false,
          draggable: true,
          columnResizable: true,
        }}
        columns={columns}
        data={data}
      />
      <Dialog
        open={!!errorModalDeployment}
        onClose={() => setErrorModalDeployment(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <ErrorIcon sx={{ color: 'error.main' }} />
              <Typography variant="h6">Job error</Typography>
            </Box>
            <IconButton onClick={() => setErrorModalDeployment(null)} size="small">
              <Close />
            </IconButton>
          </Box>
          {errorModalDeployment?.job_id && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
              Job: {errorModalDeployment.job_id}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {errorModalDeployment?.error_text && errorModalDeployment.error_text.trim().length > 0 ? (
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
              {errorModalDeployment.error_text}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No error details available for this deployment. Open the logs for full output.
            </Typography>
          )}
        </DialogContent>
      </Dialog>
      {selectedDeployment && (
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth>
          <DialogTitle>Upgrade Deployment</DialogTitle>
          <DialogContent>
            <Typography>
              Deployment ID:{' '}
              <span style={{ color: 'navy' }}>{selectedDeployment.deployment_id}</span>
            </Typography>
            <Typography>
              Current Version:{' '}
              <span style={{ color: 'darkGreen' }}>{selectedDeployment.module_version}</span>
            </Typography>
            <SimpleStepper {...args}>
              <SimpleStepperStep
                title="Select version"
                actions={{
                  canNext: () =>
                    newVersion != '' && newVersion != selectedDeployment.module_version,
                }}
              >
                <div>
                  Select a version you want to upgrade to:
                  <ModuleVersions
                    module={selectedDeployment.module}
                    module_type={selectedDeployment.module_type}
                    currentValue={newVersion}
                    onSetVersion={setNewVersion}
                    track={selectedDeployment.module_track}
                  />
                  <br />
                  Click{' '}
                  <Link
                    to={`/infraweave/${selectedDeployment.module_type}/${
                      selectedDeployment.module_track
                    }/${encodeURIComponent(selectedDeployment.module)}/${encodeURIComponent(
                      selectedDeployment.module_version,
                    )}`}
                  >
                    here to browse
                  </Link>{' '}
                  {moduleName} ({selectedDeployment.module_track}-track) in a new window.
                </div>
              </SimpleStepperStep>
              <SimpleStepperStep title="Verify changes">
                <div>
                  This version introduces following changes:
                  <ul>
                    <li>Change 1</li>
                    <li>Change 2</li>
                    <li>Change 3</li>
                  </ul>
                </div>
              </SimpleStepperStep>
              <SimpleStepperStep title="Finish" actions={{ showNext: false, showBack: false }} end>
                <div>
                  <Typography variant="body1">
                    Upgrade deployment from current version{' '}
                    <span style={{ color: 'darkGreen' }}>{selectedDeployment.module_version}</span>{' '}
                    to <span style={{ color: 'purple' }}>{newVersion}</span>?
                  </Typography>
                  <br />
                  <Typography>
                    Click the button below to initiate a merge request for performing the upgrade:
                  </Typography>
                  <br />
                  <Button variant="contained" color="primary" onClick={handleUpgrade}>
                    Create merge request
                  </Button>
                </div>
              </SimpleStepperStep>
            </SimpleStepper>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setOpenDialog(false);
              }}
              color="primary"
            >
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <DeploymentPlansModal
        open={showPlansModal}
        onClose={() => {
          setShowPlansModal(false);
          isModalOpenRef.current = false;
        }}
        projects={projects}
        selectedProjectNames={selectedProjectNames}
        selectedRegions={selectedRegions}
      />
    </>
  );
};

export const Deployments = ({ module }: { module?: string }) => {
  const { selectedProjectNames, projects, selectedRegions } = useSelectedProjects();
  const [_dialogOpen, setDialogOpen] = useState(false);

  const { deployments, loading, error, refetch, isModalOpenRef } = useDeployments(
    projects,
    selectedProjectNames,
    selectedRegions,
    module,
  );

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <DenseTable
      deployments={deployments}
      projects={projects}
      onRefresh={refetch}
      dialogOpen={setDialogOpen}
      selectedProjectNames={selectedProjectNames}
      selectedRegions={selectedRegions}
      isModalOpenRef={isModalOpenRef}
    />
  );
};

export const ModuleVersions = ({
  module,
  module_type,
  currentValue,
  onSetVersion,
  track,
}: {
  module: string;
  module_type: string;
  currentValue: string;
  onSetVersion: (cur: string) => void;
  track: string;
}) => {
  const config = useConfig();
  const { value, loading, error } = useAsync(async (): Promise<Module[]> => {
    const response = await config.fetch(
      config.getApiUrl(
        `api/proxy/api/infraweave/api/v1/${module_type}s/versions/${track}/${module}`,
      ),
    );

    if (response.status >= 300 && response.status < 400) {
      throw new Error('Redirected to login or guest page');
    }

    const json = await response.json();

    return json;
  }, []);

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  const handleVersionChange = (
    _event: React.ChangeEvent<object>,
    value: string | null,
    _reason: string,
  ) => {
    if (value) {
      onSetVersion(value);
    }
  };

  const options = value?.map((mod) => mod.version) || [];

  return (
    <Paper
      style={{
        padding: 10,
      }}
    >
      <Autocomplete
        value={currentValue}
        options={options}
        renderInput={(params) => <TextField {...params} label={`${module} version`} />}
        onChange={handleVersionChange}
      />
    </Paper>
  );
};

// Future function: add tags like "test", "deployment"
const tags: string[] = [];
