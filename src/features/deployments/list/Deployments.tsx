import React, { useMemo, useState } from 'react';
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
import { SearchField } from '../../../shared/components/SearchField';
import { ListIncomplete } from '../../../shared/components/ListIncomplete';
import { INCOMPLETE_REASON_TEXT } from '../../../utils/deploymentFetch';
import { bestFuzzyScore, bestSubstringScore } from '../../../utils/fuzzyMatch';
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
  /**
   * Focus the filter on mount. Set on the deployments page, where finding one
   * row is the whole task; left off where this table is a section of a larger
   * page, which must not have focus yanked into it.
   */
  autoFocusSearch?: boolean;
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
  autoFocusSearch = false,
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

  // The account column shows the project's display name, not the id it is keyed
  // by, so the filter has to resolve it the same way to match on what is read.
  const accountName = (deployment: Deployment) =>
    projects.find((p) => p.project_id === deployment.project_id)?.name || deployment.project_id;

  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';

  // One box for every column, rather than a filter per column: a deployment is
  // found by whichever detail the user happens to remember — the name, its
  // module, the namespace, the region, a failing status — and typing it should
  // just work. Subsequence matching means `ec2dev` finds `ec2_instance_1` in
  // `dev` without getting the separator right.
  const visibleDeployments = useMemo(() => {
    if (!searching) return deployments;

    const scoreOf = (deployment: Deployment) => {
      const scores = [
        // What identifies the row, typed from memory and rarely with the
        // separators right, so a subsequence is what has to match.
        bestFuzzyScore(query, [
          // The row shows the last segment of the id; the full one is what a link
          // or a manifest carries, so both are offered.
          deployment.deployment_id.split('/').pop(),
          deployment.deployment_id,
          deployment.module,
          deployment.environment,
        ]),
        // What the row is filed under, shared by many rows and read off the
        // screen, so it is matched literally — a subsequence of a long account
        // name is satisfied by almost anything.
        // Account is a hidden column by default, and matching it anyway is the
        // useful way round: "show me my account's rows" should not depend on
        // first unhiding the column it is written in.
        bestSubstringScore(query, [
          accountName(deployment),
          deployment.region,
          deployment.status,
          deployment.module_version,
        ]),
      ].filter((score): score is number => score !== null);

      return scores.length > 0 ? Math.max(...scores) : null;
    };

    return (
      deployments
        .map((deployment) => ({ deployment, score: scoreOf(deployment) }))
        .filter((entry): entry is { deployment: Deployment; score: number } => entry.score !== null)
        // Best match first. Ties keep the order the rows arrived in, so filtering
        // on a column every row shares — a region, a status — leaves the list as
        // it was, minus the rows that dropped out.
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.deployment)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployments, projects, query, searching]);

  const hiddenCount = deployments.length - visibleDeployments.length;
  // Terse on purpose: this sits in the table's toolbar between the column chips
  // and the History button, and a sentence there costs the search box its width.
  // The query it talks about is in the box right beside it, and "matches" says
  // the emptiness is the filter's doing rather than an empty account.
  const searchStatus = !searching
    ? null
    : visibleDeployments.length === 0
      ? 'No matches'
      : hiddenCount > 0
        ? // Otherwise a filtered table looks like the whole list.
          `${hiddenCount} hidden`
        : null;

  const data = visibleDeployments.map((deployment) => {
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
      account: accountName(deployment),
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

            {/* Between the column controls and the table's own actions: the filter
                belongs to this table, so it sits in the table's toolbar rather
                than floating above the card.
                Hidden while there is nothing to filter, so an empty list is not
                dressed up as a search that missed. */}
            {(deployments.length > 0 || searching) && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  // Takes the slack the two fixed groups leave, growing wide on a
                  // wide window. The small basis is what keeps the row intact: a
                  // wrap decision is made on basis alone, so asking for the full
                  // 300px up front pushes Tags and History onto a second line.
                  flex: '1 1 150px',
                  minWidth: 0,
                  // On a narrow window the status drops below the box rather than
                  // squeezing it down to its adornments.
                  flexWrap: 'wrap',
                }}
              >
                <SearchField
                  value={query}
                  onChange={setQuery}
                  placeholder="Search deployments"
                  autoFocus={autoFocusSearch}
                  // Left edge is fixed and only the right edge moves, so the text
                  // being typed never slides sideways. The floor keeps a few words
                  // of the query visible however tight the toolbar gets.
                  sx={{ flexGrow: 1, flexBasis: 150, minWidth: 150, maxWidth: 300 }}
                />
                {/* Announced: the rows change as the query is typed, with no other
                    cue. Kept here rather than passed to the table as empty
                    content, which would replace the whole card — this toolbar
                    included — whenever nothing matched. */}
                {searchStatus && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    role="status"
                    sx={{ flexShrink: 0 }}
                  >
                    {searchStatus}
                  </Typography>
                )}
              </Box>
            )}

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

  const { deployments, loading, error, incomplete, refetch, isModalOpenRef } = useDeployments(
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
    <>
      <DenseTable
        deployments={deployments}
        projects={projects}
        onRefresh={refetch}
        dialogOpen={setDialogOpen}
        selectedProjectNames={selectedProjectNames}
        selectedRegions={selectedRegions}
        isModalOpenRef={isModalOpenRef}
        // `module` is only set where this list is one tab of a module or stack
        // page: there the filter is a section of the page, so it waits to be
        // clicked into. On the deployments page itself it is the point of the page.
        autoFocusSearch={!module}
      />
      {incomplete && (
        <ListIncomplete label="deployments" reason={INCOMPLETE_REASON_TEXT[incomplete]} />
      )}
    </>
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
