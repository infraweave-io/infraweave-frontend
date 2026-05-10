import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Chip,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Tooltip,
  CircularProgress,
  Alert,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Drawer,
} from '@mui/material';
import { Link } from '../../../standalone/components/ComponentAdapter';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DraftsOutlinedIcon from '@mui/icons-material/DraftsOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HistoryIcon from '@mui/icons-material/History';
import ArticleIcon from '@mui/icons-material/Article';
import { useConfig } from '../../../hooks/useConfig';
import { Deployment, Project } from '../../../types/Deployment';
import { Event } from '../../../types/Event';
import { ChangeRecord } from '../../../types/Log';
import { DrawerContent } from '../detail/ReadLogsButton';

interface DeploymentWithEvents extends Deployment {
  events?: Event[];
  lastChangeRecord?: ChangeRecord;
  lastChangeTimestamp?: string;
  deleted?: boolean;
}

interface DeploymentPlansModalProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  selectedProjectNames: string[];
  selectedRegions: string[];
}

type FilterType = 'planned' | 'deleted';

export const DeploymentPlansModal: React.FC<DeploymentPlansModalProps> = ({
  open,
  onClose,
  projects,
  selectedProjectNames,
  selectedRegions,
}) => {
  const config = useConfig();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployments, setDeployments] = useState<DeploymentWithEvents[]>([]);
  const [filterType, setFilterType] = useState<FilterType>('planned');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'timestamp' | 'name'>('timestamp');
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    deploymentId: 250,
    type: 100,
    module: 200,
    version: 100,
    region: 120,
    actions: 150,
    lastChange: 180,
  });
  const [resizing, setResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedDeploymentForDrawer, setSelectedDeploymentForDrawer] =
    useState<DeploymentWithEvents | null>(null);
  const [drawerViewLogs, setDrawerViewLogs] = useState(false);

  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    setResizing(columnKey);
    setStartX(e.clientX);
    setStartWidth(columnWidths[columnKey]);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;
      const diff = e.clientX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [resizing]: Math.max(50, startWidth + diff),
      }));
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, startX, startWidth]);

  useEffect(() => {
    if (open) {
      fetchAllDeployments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedProjectNames, selectedRegions, filterType]);

  const fetchAllDeployments = async () => {
    setLoading(true);
    setError(null);
    try {
      const selectedProjectIds = projects
        .filter((project) => selectedProjectNames.includes(project.name))
        .map((project) => project.project_id);

      if (selectedProjectIds.length === 0) {
        setDeployments([]);
        return;
      }

      // Fetch only the data needed based on filter type
      const fetchPromises = selectedProjectIds.flatMap((projectId) =>
        selectedRegions.map((region) => {
          if (filterType === 'planned') {
            // Fetch plan history
            return config
              .fetch(
                config.getApiUrl(
                  `api/proxy/api/infraweave/api/v1/deployments/history/${projectId}/${region}?type=plans&limit=100`,
                ),
              )
              .then(async (response) => {
                if (!response.ok) return { type: 'plans', items: [] };
                const json = await response.json();
                return { type: 'plans', items: Array.isArray(json) ? json : json.Items || [] };
              })
              .catch(() => ({ type: 'plans', items: [] }));
          }
          // Fetch deleted deployments
          return config
            .fetch(
              config.getApiUrl(
                `api/proxy/api/infraweave/api/v1/deployments/history/${projectId}/${region}?type=deleted&limit=100`,
              ),
            )
            .then(async (response) => {
              if (!response.ok) return { type: 'deleted', items: [] };
              const json = await response.json();
              return { type: 'deleted', items: Array.isArray(json) ? json : json.Items || [] };
            })
            .catch(() => ({ type: 'deleted', items: [] }));
        }),
      );

      const results = await Promise.all(fetchPromises);

      // Combine and transform data
      const deploymentList: DeploymentWithEvents[] = [];

      if (filterType === 'planned') {
        // Process plan history records
        results
          .filter((r) => r.type === 'plans')
          .forEach((result) => {
            result.items.forEach((record: any) => {
              // Add each plan without deduplication
              deploymentList.push({
                deployment_id: record.deployment_id || 'Unknown',
                project_id: record.project_id || '',
                region: record.region || '',
                environment: record.environment || 'unknown',
                module: record.module || 'unknown',
                module_version: record.module_version || 'unknown',
                status: 'requested',
                epoch: record.epoch || 0,
                job_id: record.job_id || '',
                deleted: false,
                initiated_by: record.initiated_by || '',
                module_type: record.module_type || 'module',
                module_track: record.module_track || 'stable',
                variables: {},
                dependencies: [],
                dependants: [],
                reference: '',
                error_text: '',
                output: {},
                has_drifted: false,
                policy_results: [],
                drift_detection: {
                  enabled: false,
                  interval: '',
                  auto_remediate: false,
                },
                next_drift_check_epoch: 0,
                events: [],
                lastChangeTimestamp: record.timestamp || new Date(record.epoch).toISOString(),
                lastChangeRecord: {
                  timestamp: record.timestamp || new Date(record.epoch).toISOString(),
                  resource_changes: [],
                  plan_std_output: '',
                },
              } as DeploymentWithEvents);
            });
          });
      } else {
        // Process deleted deployments
        results
          .filter((r) => r.type === 'deleted')
          .forEach((result) => {
            console.log('Processing deleted deployments, count:', result.items.length);
            result.items.forEach((record: any) => {
              console.log('Deleted deployment:', record.deployment_id);
              // Add each deleted deployment
              deploymentList.push({
                deployment_id: record.deployment_id || 'Unknown',
                project_id: record.project_id || '',
                region: record.region || '',
                environment: record.environment || 'unknown',
                module: record.module || 'unknown',
                module_version: record.module_version || 'unknown',
                status: record.status || 'destroyed',
                epoch: record.epoch || 0,
                job_id: record.job_id || '',
                deleted: true,
                initiated_by: record.initiated_by || '',
                module_type: record.module_type || 'module',
                module_track: record.module_track || 'stable',
                variables: {},
                dependencies: [],
                dependants: [],
                reference: '',
                error_text: '',
                output: {},
                has_drifted: false,
                policy_results: [],
                drift_detection: {
                  enabled: false,
                  interval: '',
                  auto_remediate: false,
                },
                next_drift_check_epoch: 0,
                events: [],
                lastChangeTimestamp: record.timestamp || new Date(record.epoch).toISOString(),
              } as DeploymentWithEvents);
            });
          });
      }

      // Sort by timestamp, newest first
      deploymentList.sort((a, b) => {
        const timeA = new Date(a.lastChangeTimestamp || 0).getTime();
        const timeB = new Date(b.lastChangeTimestamp || 0).getTime();
        return timeB - timeA;
      });

      setDeployments(deploymentList);
      console.log('Loaded deployments:', deploymentList);
    } catch (err) {
      console.error('Error fetching deployments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch deployments');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort deployments
  const filteredDeployments = deployments
    .filter((deployment) => {
      // Filter by type
      if (filterType === 'deleted') {
        console.log(
          'Checking deleted filter for:',
          deployment.deployment_id,
          'deleted:',
          deployment.deleted,
        );
        if (!deployment.deleted) return false;
      }
      if (filterType === 'planned' && deployment.status !== 'requested') return false;

      // Filter by search text
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        return (
          deployment.deployment_id.toLowerCase().includes(searchLower) ||
          deployment.module.toLowerCase().includes(searchLower)
        );
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'timestamp') {
        const timeA = new Date(a.lastChangeTimestamp || 0).getTime();
        const timeB = new Date(b.lastChangeTimestamp || 0).getTime();
        return timeB - timeA; // Most recent first
      }
      return a.deployment_id.localeCompare(b.deployment_id);
    });

  const _getStatusIcon = (deployment: DeploymentWithEvents) => {
    if (deployment.deleted) {
      return <DeleteOutlineIcon color="error" />;
    }
    if (deployment.status === 'requested') {
      return <DraftsOutlinedIcon color="info" />;
    }
    if (deployment.status === 'completed') {
      return <CheckCircleOutlineIcon color="success" />;
    }
    if (deployment.status === 'failed') {
      return <ErrorOutlineIcon color="error" />;
    }
    return null;
  };

  const _getResourceChangesSummary = (deployment: DeploymentWithEvents) => {
    const changes = deployment.lastChangeRecord?.resource_changes;
    if (!changes) return null;

    const summary = changes.reduce(
      (acc, change) => {
        if (change.action === 'create') acc.create++;
        else if (change.action === 'update') acc.update++;
        else if (change.action === 'delete') acc.delete++;
        return acc;
      },
      { create: 0, update: 0, delete: 0 },
    );

    return (
      <Box display="flex" gap={1} mt={1}>
        {summary.create > 0 && (
          <Chip label={`+${summary.create}`} size="small" color="success" variant="outlined" />
        )}
        {summary.update > 0 && (
          <Chip label={`~${summary.update}`} size="small" color="warning" variant="outlined" />
        )}
        {summary.delete > 0 && (
          <Chip label={`-${summary.delete}`} size="small" color="error" variant="outlined" />
        )}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon />
            <Typography variant="h6">Deployment Plans & History</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent>
        {/* Filters */}
        <Box mb={3}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                size="small"
                label="Search"
                placeholder="Search by ID, environment, module..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter Type</InputLabel>
                <Select
                  value={filterType}
                  label="Filter Type"
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                >
                  <MenuItem value="planned">Plan Only</MenuItem>
                  <MenuItem value="deleted">Deleted Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => setSortBy(e.target.value as 'timestamp' | 'name')}
                >
                  <MenuItem value="timestamp">Last Change (Newest)</MenuItem>
                  <MenuItem value="name">Name (A-Z)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        {/* Results summary */}
        <Box mb={2}>
          <Typography variant="body2" color="text.secondary">
            Showing {filteredDeployments.length} of {deployments.length} deployments
          </Typography>
        </Box>

        {/* Loading state */}
        {loading && (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        )}

        {/* Error state */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Deployment table */}
        {!loading && !error && (
          <TableContainer component={Paper} sx={{ maxHeight: '60vh' }}>
            {filteredDeployments.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body2" color="text.secondary">
                  No deployments found matching your filters
                </Typography>
              </Box>
            ) : (
              <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        width: columnWidths.deploymentId,
                        position: 'relative',
                        userSelect: 'none',
                      }}
                    >
                      Deployment ID
                      <Box
                        onMouseDown={(e) => handleResizeStart(e, 'deploymentId')}
                        sx={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '5px',
                          cursor: 'col-resize',
                          '&:hover': { backgroundColor: 'primary.main', opacity: 0.3 },
                        }}
                      />
                    </TableCell>
                    <TableCell
                      sx={{ width: columnWidths.type, position: 'relative', userSelect: 'none' }}
                    >
                      Type
                      <Box
                        onMouseDown={(e) => handleResizeStart(e, 'type')}
                        sx={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '5px',
                          cursor: 'col-resize',
                          '&:hover': { backgroundColor: 'primary.main', opacity: 0.3 },
                        }}
                      />
                    </TableCell>
                    <TableCell
                      sx={{ width: columnWidths.module, position: 'relative', userSelect: 'none' }}
                    >
                      Module
                      <Box
                        onMouseDown={(e) => handleResizeStart(e, 'module')}
                        sx={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '5px',
                          cursor: 'col-resize',
                          '&:hover': { backgroundColor: 'primary.main', opacity: 0.3 },
                        }}
                      />
                    </TableCell>

                    <TableCell
                      sx={{ width: columnWidths.version, position: 'relative', userSelect: 'none' }}
                    >
                      Version
                      <Box
                        onMouseDown={(e) => handleResizeStart(e, 'version')}
                        sx={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '5px',
                          cursor: 'col-resize',
                          '&:hover': { backgroundColor: 'primary.main', opacity: 0.3 },
                        }}
                      />
                    </TableCell>

                    <TableCell
                      sx={{ width: columnWidths.region, position: 'relative', userSelect: 'none' }}
                    >
                      Region
                      <Box
                        onMouseDown={(e) => handleResizeStart(e, 'region')}
                        sx={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '5px',
                          cursor: 'col-resize',
                          '&:hover': { backgroundColor: 'primary.main', opacity: 0.3 },
                        }}
                      />
                    </TableCell>

                    <TableCell
                      sx={{ width: columnWidths.actions, position: 'relative', userSelect: 'none' }}
                    >
                      Actions
                      <Box
                        onMouseDown={(e) => handleResizeStart(e, 'actions')}
                        sx={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '5px',
                          cursor: 'col-resize',
                          '&:hover': { backgroundColor: 'primary.main', opacity: 0.3 },
                        }}
                      />
                    </TableCell>

                    <TableCell
                      align="right"
                      sx={{
                        width: columnWidths.lastChange,
                        position: 'relative',
                        userSelect: 'none',
                      }}
                    >
                      Last Change
                      <Box
                        onMouseDown={(e) => handleResizeStart(e, 'lastChange')}
                        sx={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '5px',
                          cursor: 'col-resize',
                          '&:hover': { backgroundColor: 'primary.main', opacity: 0.3 },
                        }}
                      />
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDeployments.map((deployment) => {
                    const encodedEnvironment = encodeURIComponent(deployment.environment || '');
                    const encodedDeploymentId = encodeURIComponent(deployment.deployment_id || '');
                    const deploymentLink = `/infraweave/deployment/${deployment.project_id}/${deployment.region}/${encodedEnvironment}/${encodedDeploymentId}/overview`;

                    return (
                      <TableRow
                        key={`${deployment.project_id}-${deployment.region}-${deployment.environment}-${deployment.deployment_id}`}
                        hover
                        sx={{
                          borderLeft: deployment.deleted
                            ? '4px solid #f44336'
                            : deployment.status === 'requested'
                              ? '4px solid #2196f3'
                              : '4px solid #4caf50',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        <TableCell
                          sx={{
                            width: columnWidths.deploymentId,
                            backgroundColor: 'background.paper',
                            overflow: 'hidden',
                          }}
                        >
                          <Box display="flex" flexDirection="column" gap={0.5}>
                            {deployment.deleted ? (
                              <Link to={deploymentLink} style={{ textDecoration: 'none' }}>
                                <Typography
                                  variant="body2"
                                  noWrap
                                  sx={{
                                    fontWeight: 500,
                                    color: 'primary.main',
                                    '&:hover': { textDecoration: 'underline' },
                                  }}
                                >
                                  {deployment.deployment_id?.split('/').pop() ||
                                    deployment.deployment_id ||
                                    'Unknown'}
                                </Typography>
                              </Link>
                            ) : (
                              <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                                {deployment.deployment_id?.split('/').pop() ||
                                  deployment.deployment_id ||
                                  'Unknown'}
                              </Typography>
                            )}
                            <Typography
                              variant="caption"
                              noWrap
                              sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
                            >
                              {deployment.environment || 'N/A'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell
                          sx={{
                            width: columnWidths.type,
                            backgroundColor: 'background.paper',
                            overflow: 'hidden',
                          }}
                        >
                          {deployment.deleted && (
                            <Chip
                              label="DELETED"
                              size="small"
                              color="error"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                          {deployment.status === 'requested' && !deployment.deleted && (
                            <Chip
                              label="PLAN"
                              size="small"
                              color="info"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </TableCell>
                        <TableCell
                          sx={{
                            width: columnWidths.module,
                            backgroundColor: 'background.paper',
                            overflow: 'hidden',
                          }}
                        >
                          <Typography variant="body2" noWrap>
                            {deployment.module || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell
                          sx={{
                            width: columnWidths.version,
                            backgroundColor: 'background.paper',
                            overflow: 'hidden',
                          }}
                        >
                          {deployment.module &&
                          deployment.module_version &&
                          deployment.module_version !== 'N/A' ? (
                            <Link
                              to={`/infraweave/module/${
                                deployment.module_track || 'stable'
                              }/${encodeURIComponent(deployment.module)}/${encodeURIComponent(
                                deployment.module_version,
                              )}`}
                              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                            >
                              {deployment.module_version}
                            </Link>
                          ) : (
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                            >
                              {deployment.module_version || 'N/A'}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell
                          sx={{
                            width: columnWidths.region,
                            backgroundColor: 'background.paper',
                            overflow: 'hidden',
                          }}
                        >
                          <Typography variant="body2" noWrap>
                            {deployment.region || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell
                          sx={{
                            width: columnWidths.actions,
                            backgroundColor: 'background.paper',
                            overflow: 'hidden',
                          }}
                        >
                          <Box display="flex" gap={0.5}>
                            <Tooltip title="View Change Record">
                              <IconButton
                                size="small"
                                sx={{ padding: 0.5 }}
                                onClick={() => {
                                  setSelectedDeploymentForDrawer(deployment);
                                  setDrawerViewLogs(false);
                                  setDrawerOpen(true);
                                }}
                              >
                                <HistoryIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View Logs">
                              <IconButton
                                size="small"
                                sx={{ padding: 0.5 }}
                                onClick={() => {
                                  setSelectedDeploymentForDrawer(deployment);
                                  setDrawerViewLogs(true);
                                  setDrawerOpen(true);
                                }}
                              >
                                <ArticleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            width: columnWidths.lastChange,
                            backgroundColor: 'background.paper',
                            overflow: 'hidden',
                          }}
                        >
                          <Typography variant="body2" noWrap sx={{ fontSize: '0.85rem' }}>
                            {deployment.lastChangeTimestamp
                              ? new Date(deployment.lastChangeTimestamp).toLocaleString()
                              : 'N/A'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        )}

        {/* Action buttons */}
        <Box mt={3} display="flex" justifyContent="flex-end" gap={2}>
          <Button onClick={fetchAllDeployments} disabled={loading}>
            Refresh
          </Button>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </Box>
      </DialogContent>

      {/* Drawer for viewing logs and change records */}
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
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
      >
        <DrawerContent
          toggleDrawer={setDrawerOpen}
          event={
            selectedDeploymentForDrawer
              ? ({
                  job_id: selectedDeploymentForDrawer.job_id || '',
                  deployment_id: selectedDeploymentForDrawer.deployment_id || '',
                  environment: selectedDeploymentForDrawer.environment || '',
                  epoch: new Date(
                    selectedDeploymentForDrawer.lastChangeTimestamp || Date.now(),
                  ).getTime(),
                  event: selectedDeploymentForDrawer.deleted ? 'DESTROY' : 'PLAN',
                  status: selectedDeploymentForDrawer.status || 'unknown',
                  module_version: selectedDeploymentForDrawer.module_version,
                  module: selectedDeploymentForDrawer.module || '',
                  initiated_by: selectedDeploymentForDrawer.initiated_by || '',
                  timestamp:
                    selectedDeploymentForDrawer.lastChangeTimestamp || new Date().toISOString(),
                } as Event)
              : undefined
          }
          deployment={selectedDeploymentForDrawer as Deployment}
          viewLogs={drawerViewLogs}
        />
      </Drawer>
    </Dialog>
  );
};
