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
  Chip,
} from '@mui/material';
import { MONO_FONT } from '../../../contexts/ThemeContext';
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
const RemovableHeader = ({ title, onRemove }: { title: string; onRemove: () => void }) => (
  <Box
    display="flex"
    alignItems="center"
    justifyContent="space-between"
    width="100%"
    // Reveal on hover via CSS rather than hover state: one less render per
    // pointer move across a table that can hold hundreds of rows.
    sx={{ '&:hover .column-hide': { opacity: 1 } }}
  >
    <span>{title}</span>
    <Tooltip title="Hide column">
      <IconButton
        className="column-hide"
        size="small"
        aria-label={`Hide ${title} column`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        sx={{
          ml: 1,
          padding: 0.25,
          color: 'text.secondary',
          opacity: 0,
          transition: 'opacity 120ms ease',
          '&:focus-visible': { opacity: 1 },
        }}
      >
        <VisibilityOffIcon sx={{ fontSize: 15 }} />
      </IconButton>
    </Tooltip>
  </Box>
);

/** Chip that restores a column the user previously hid. */
const AddColumnChip = ({ label, onAdd }: { label: string; onAdd: () => void }) => (
  <Chip
    label={label}
    size="small"
    variant="outlined"
    onClick={onAdd}
    icon={<VisibilityIcon sx={{ fontSize: 14 }} />}
    sx={{
      borderStyle: 'dashed',
      color: 'text.secondary',
      '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
    }}
  />
);

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

  const hiddenColumns = [
    { label: 'Timestamp', visible: showTimestamp, show: setShowTimestamp },
    { label: 'Account', visible: showAccount, show: setShowAccount },
    { label: 'Region', visible: showRegion, show: setShowRegion },
    { label: 'Drift check', visible: showDriftCheck, show: setShowDriftCheck },
  ].filter((column) => !column.visible);

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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Link to={deployment_link} style={{ fontFamily: MONO_FONT }}>
            {deployment.deployment_id.split('/').pop()}
          </Link>
          <Typography variant="caption" color="text.secondary">
            {deployment.module}
          </Typography>
        </Box>
      ),
      namespace: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <span>
            {deployment?.environment.split('/').slice(1).join('/') || deployment?.environment}
          </span>
          <Typography variant="caption" color="text.secondary">
            {deployment?.environment.split('/')[0]}
          </Typography>
        </Box>
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
      timestamp: (
        <Typography variant="body2" sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
          {deployment.epoch ? new Date(deployment.epoch).toLocaleString() : 'N/A'}
        </Typography>
      ),
      // environment: deployment.environment,
      module_version: (
        <Box display="flex" alignItems="center" gap={0.5}>
          <Box component="span" sx={{ fontFamily: MONO_FONT, fontSize: '0.8125rem' }}>
            <VersionCell version={deployment.module_version} />
          </Box>
          <Tooltip title="Upgrade version">
            <IconButton
              size="small"
              aria-label="Upgrade version"
              onClick={() => {
                setSelectedDeployment(deployment);
                setNewVersion('');
                setOpenDialog(true);
                dialogOpen(true);
              }}
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <UpdateIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              flexWrap: 'wrap',
            }}
          >
            <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
              <Tooltip title="Refresh deployments">
                <IconButton size="small" onClick={onRefresh} sx={{ color: 'text.secondary' }}>
                  <Refresh fontSize="small" />
                </IconButton>
              </Tooltip>
              {hiddenColumns.length > 0 && (
                <>
                  <Box sx={{ width: '1px', height: 18, bgcolor: 'divider', mx: 0.5 }} />
                  <Typography variant="caption" color="text.secondary">
                    Add column
                  </Typography>
                  {hiddenColumns.map(({ label, show }) => (
                    <AddColumnChip key={label} label={label} onAdd={() => show(true)} />
                  ))}
                </>
              )}
            </Box>

            <Box display="flex" gap={1} alignItems="center">
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
                sx={{ minWidth: 140 }}
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
                >
                  History
                </Button>
              </Tooltip>
            </Box>
          </Box>
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
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: MONO_FONT }}>
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
                fontFamily: MONO_FONT,
                fontSize: '0.8125rem',
                border: '1px solid',
                borderColor: 'divider',
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
          <DialogTitle>Upgrade deployment</DialogTitle>
          <DialogContent>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                columnGap: 2,
                rowGap: 0.5,
                mb: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Deployment ID
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: MONO_FONT }}>
                {selectedDeployment.deployment_id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Current version
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: MONO_FONT }}>
                {selectedDeployment.module_version}
              </Typography>
            </Box>
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
                    <Box component="span" sx={{ fontFamily: MONO_FONT, fontWeight: 500 }}>
                      {selectedDeployment.module_version}
                    </Box>{' '}
                    to{' '}
                    <Box
                      component="span"
                      sx={{ fontFamily: MONO_FONT, fontWeight: 600, color: 'primary.main' }}
                    >
                      {newVersion}
                    </Box>
                    ?
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
    <Paper variant="outlined" sx={{ p: 1.5, mt: 1 }}>
      <Autocomplete
        value={currentValue}
        options={options}
        renderInput={(params) => <TextField {...params} size="small" label={`${module} version`} />}
        onChange={handleVersionChange}
      />
    </Paper>
  );
};

// Future function: add tags like "test", "deployment"
const tags: string[] = [];
