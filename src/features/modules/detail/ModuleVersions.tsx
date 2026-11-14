import React, { useState } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import {
  Table,
  TableColumn,
  Progress,
  ResponseErrorPanel,
  Link,
} from '../../../standalone/components/ComponentAdapter';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Tooltip,
  Button,
  Autocomplete,
  TextField,
  Grid,
  Chip,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { ZipBrowser } from '../../../shared/components/ZipBrowser';
import { useAsync } from '../../../hooks/useAsync';
import { Module } from '../../../types/Module';
import { ChangesTags } from './VersionDiff';
import { Deployment } from '../../../types/Deployment';
import {
  fetchDeployments,
  IncompleteReason,
  INCOMPLETE_REASON_TEXT,
} from '../../../utils/deploymentFetch';
import { LoadingMore } from '../../../shared/components/LoadingMore';
import { ListIncomplete } from '../../../shared/components/ListIncomplete';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import { VersionCell } from '../../../shared/components/VersionCell';

/** Every track a version can be published to. */
const TRACKS = ['stable', 'beta', 'alpha', 'dev'];

/** Shared empty default, so callers that pass no version list keep a stable identity. */
const NO_VERSIONS: Module[] = [];

/** A popular module has hundreds of deployments, so all are loaded but one page is rendered. */
const DEPLOYMENTS_PAGE_SIZE = 50;
const DEPLOYMENTS_PAGE_SIZES = [25, 50, 100, 250];

type DenseTableProps = {
  modules: Module[];
  hideChanges?: boolean;
  hideTitle?: boolean;
  showTrack?: boolean;
  onVersionClick?: () => void;
  resourceType?: 'module' | 'stack';
  onCompare?: (version: string, track?: string) => void;
  moduleName?: string;
  includeDev000?: boolean;
  onIncludeDev000Change?: (checked: boolean) => void;
  includeDeprecated?: boolean;
  onIncludeDeprecatedChange?: (checked: boolean) => void;
};

export const DenseTable = ({
  modules,
  hideChanges = false,
  hideTitle = false,
  showTrack = false,
  onVersionClick,
  resourceType = 'module',
  onCompare,
  moduleName,
  includeDev000,
  onIncludeDev000Change,
  includeDeprecated,
  onIncludeDeprecatedChange,
}: DenseTableProps) => {
  const config = useConfig();
  const [openZipBrowser, setOpenZipBrowser] = useState(false);
  const [selectedZipUrl, setSelectedZipUrl] = useState<string | null>(null);
  const [selectedModuleName, setSelectedModuleName] = useState<string>('');
  const [selectedModuleVersion, setSelectedModuleVersion] = useState<string>('');

  // Deployments Dialog State
  const [openDeployments, setOpenDeployments] = useState(false);
  const [selectedVersionForDeployments, setSelectedVersionForDeployments] = useState<string | null>(
    null,
  );

  const handleBrowseClick = (name: string, track: string, version: string) => {
    const encodedName = encodeURIComponent(name);
    const encodedVersion = encodeURIComponent(version);
    const url = config.getApiUrl(
      `api/proxy/api/infraweave/api/v1/${resourceType}/${track}/${encodedName}/${encodedVersion}/download`,
    );
    setSelectedZipUrl(url);
    setSelectedModuleName(name);
    setSelectedModuleVersion(version);
    setOpenZipBrowser(true);
  };

  const handleDeploymentsClick = (version: string, name: string) => {
    setSelectedVersionForDeployments(version);
    if (!moduleName && name) {
      setSelectedModuleName(name);
    }
    setOpenDeployments(true);
  };

  const columns: TableColumn[] = hideChanges
    ? showTrack
      ? [
          { title: 'Track', width: '100', field: 'track' },
          { title: 'Version', width: '200', field: 'version' },
          { title: 'Published', width: '200', field: 'published' },
          { title: 'Artifact', width: '100', field: 'artifact' },
          { title: 'Actions', width: '100', field: 'actions' },
        ]
      : [
          { title: 'Version', width: '200', field: 'version' },
          { title: 'Published', width: '200', field: 'published' },
          { title: 'Artifact', width: '100', field: 'artifact' },
          { title: 'Actions', width: '100', field: 'actions' },
        ]
    : showTrack
      ? [
          { title: 'Track', width: '100', field: 'track' },
          { title: 'Version', width: '200', field: 'version' },
          { title: 'Published', width: '200', field: 'published' },
          { title: 'Changes', width: '400', field: 'diffs' },
          { title: 'Artifact', width: '100', field: 'artifact' },
          { title: 'Actions', width: '100', field: 'actions' },
        ]
      : [
          { title: 'Version', width: '200', field: 'version' },
          { title: 'Published', width: '200', field: 'published' },
          { title: 'Changes', width: '400', field: 'diffs' },
          { title: 'Artifact', width: '100', field: 'artifact' },
          { title: 'Actions', width: '100', field: 'actions' },
        ];

  // Sort modules by timestamp (newest first)
  const sortedModules = [...modules].sort((a, b) => {
    const dateA = new Date(a.timestamp || 0).getTime();
    const dateB = new Date(b.timestamp || 0).getTime();
    return dateB - dateA;
  });

  const data = sortedModules.map((mod) => {
    const track = mod.track;
    const encodedModuleName = encodeURIComponent(mod.module ?? '');
    const encodedModuleVersion = encodeURIComponent(mod.version ?? '');

    const module_link = `/infraweave/${resourceType}/${track}/${encodedModuleName}/${encodedModuleVersion}`;
    const moduleData: any = {
      module: `${mod.module_name || mod.module}`,
      version: (
        <Box display="flex" alignItems="center">
          <Link to={module_link} onClick={onVersionClick}>
            {mod.version}
          </Link>
          {mod.deprecated && (
            <Chip
              label="Deprecated"
              size="small"
              color="error"
              variant="outlined"
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </Box>
      ),
      published: mod.timestamp ? new Date(mod.timestamp).toLocaleString() : '',
      artifact: mod.s3_key ? (
        <Tooltip title="Browse Artifact">
          <IconButton
            size="small"
            onClick={() =>
              handleBrowseClick(mod.module || mod.module_name || '', mod.track, mod.version)
            }
          >
            <CodeIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null,
      actions: (
        <React.Fragment>
          {onCompare && (
            <Tooltip title="Compare with current">
              <IconButton size="small" onClick={() => onCompare(mod.version, mod.track)}>
                <CompareArrowsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={`Check ${resourceType}s deployed using this version`}>
            <IconButton
              size="small"
              onClick={() =>
                handleDeploymentsClick(
                  mod.version,
                  mod.module_name || mod.module || moduleName || '',
                )
              }
            >
              <CloudQueueIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </React.Fragment>
      ),
    };

    if (showTrack) {
      moduleData.track = track;
    }

    if (!hideChanges) {
      moduleData.diffs = mod.version_diff && <ChangesTags versionDiff={mod.version_diff} />;
    }

    return moduleData;
  });

  return (
    <>
      <Table
        title={
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center">
              <Typography variant="h6" sx={{ mr: 2 }}>
                {hideTitle ? '' : resourceType === 'stack' ? 'Stack Versions' : 'Module Versions'}
              </Typography>
              {onIncludeDev000Change && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeDev000}
                      onChange={(e) => onIncludeDev000Change(e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">Include 0.0.0-dev</Typography>}
                />
              )}
              {onIncludeDeprecatedChange && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeDeprecated}
                      onChange={(e) => onIncludeDeprecatedChange(e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">Include deprecated</Typography>}
                />
              )}
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CloudQueueIcon />}
              onClick={() => handleDeploymentsClick('', moduleName || '')}
            >
              Deployments using this {resourceType}
            </Button>
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
        open={openZipBrowser}
        onClose={() => setOpenZipBrowser(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Browsing: {selectedModuleName} ({selectedModuleVersion})
            </Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => setOpenZipBrowser(false)}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedZipUrl && <ZipBrowser url={selectedZipUrl} height="70vh" />}
        </DialogContent>
      </Dialog>

      {openDeployments && (
        <DeploymentsDialog
          open={openDeployments}
          onClose={() => setOpenDeployments(false)}
          moduleName={moduleName || selectedModuleName}
          version={selectedVersionForDeployments || ''}
          knownVersions={modules}
          resourceType={resourceType}
        />
      )}
    </>
  );
};

export const DeploymentsDialog = ({
  open,
  onClose,
  moduleName,
  version,
  knownVersions = NO_VERSIONS,
  resourceType = 'module',
}: {
  open: boolean;
  onClose: () => void;
  moduleName: string;
  version: string;
  knownVersions?: Module[];
  resourceType?: 'module' | 'stack';
}) => {
  const config = useConfig();
  const [projects, setProjects] = useState<any[]>([]);
  const [publishedVersions, setPublishedVersions] = useState<Module[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [allDeployments, setAllDeployments] = useState<Deployment[]>([]);
  const [incomplete, setIncomplete] = useState<IncompleteReason | undefined>(undefined);
  // Separate, so the deployments effect settling on an empty selection before the projects
  // arrive does not end the spinner.
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize selected versions when modal opens
  React.useEffect(() => {
    if (open && version) {
      setSelectedVersions([version]);
    } else {
      setSelectedVersions([]);
    }
  }, [open, version]);

  // The filters should offer every published version, not only deployed ones. knownVersions
  // is limited to one track and the caller's dev000/deprecated toggles, so fetch all tracks.
  React.useEffect(() => {
    if (!open || !moduleName) return undefined;

    let cancelled = false;
    const fetchPublishedVersions = async () => {
      const fields = ['module', 'module_name', 'track', 'version', 'timestamp'].join(',');
      const queryParams = `include_dev000=true&include_deprecated=true&fields=${fields}`;

      const results = await Promise.all(
        TRACKS.map((track) =>
          config
            .fetch(
              config.getApiUrl(
                `api/proxy/api/infraweave/api/v1/${resourceType}s/versions/${track}/${encodeURIComponent(
                  moduleName,
                )}?${queryParams}`,
              ),
            )
            .then((r) => (r.ok ? r.json() : []))
            .then((json) => {
              const items = json.Items || json.items || json;
              return Array.isArray(items) ? (items as Module[]) : [];
            })
            .catch(() => [] as Module[]),
        ),
      );

      if (!cancelled) setPublishedVersions(results.flat());
    };

    fetchPublishedVersions();
    return () => {
      cancelled = true;
    };
  }, [open, moduleName, resourceType, config]);

  // knownVersions and the fetched list can each hold versions the other lacks, so merge them.
  const allVersions = React.useMemo(() => {
    const byTrackAndVersion = new Map<string, Module>();
    for (const mod of [...knownVersions, ...publishedVersions]) {
      if (!mod?.version) continue;
      byTrackAndVersion.set(`${mod.track || ''}#${mod.version}`, mod);
    }
    return Array.from(byTrackAndVersion.values());
  }, [knownVersions, publishedVersions]);

  // Deployment records do not always carry the track they were deployed from; fill it in from
  // the published versions so the track filter can reach them.
  const trackedDeployments = React.useMemo(
    () =>
      allDeployments.map((d) => {
        if (d.module_track || !d.module_version) return d;
        const match = allVersions.find((v) => v.version === d.module_version);
        return match?.track ? { ...d, module_track: match.track } : d;
      }),
    [allDeployments, allVersions],
  );

  // Fetch projects and regions on open
  React.useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setProjectsLoading(true);
    setError(null);
    config
      .fetch(config.getApiUrl('api/proxy/api/infraweave/api/v1/projects'))
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch projects');
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setProjects(data);
        const regions = Array.from(new Set(data.flatMap((p: any) => p.regions || []))) as string[];
        setAvailableRegions(regions);

        // Default select all
        const allProjectIds: string[] = data.map((p: any) => p.project_id);
        setSelectedProjectIds(allProjectIds);
        setSelectedRegions(regions);
        // Set with the selection, so no frame shows "no deployments" before the deployments
        // effect has started loading them.
        if (allProjectIds.length > 0 && regions.length > 0) setLoading(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, config]);

  // Fetch deployments when filters change
  React.useEffect(() => {
    if (!open || selectedProjectIds.length === 0 || selectedRegions.length === 0) {
      if (open) {
        setAllDeployments([]);
        setIncomplete(undefined);
        // A load this replaced was cancelled and will not clear its own spinner.
        setLoading(false);
      }
      return undefined;
    }

    // A load spans many requests, so a run replaced by a filter change or a close must stop
    // asking and stop writing state, or its remaining pages land behind the new run's.
    const controller = new AbortController();
    const cancelled = () => controller.signal.aborted;

    const loadDeployments = async () => {
      setLoading(true);
      setError(null);
      setAllDeployments([]);
      setIncomplete(undefined);
      try {
        await fetchDeployments(config, {
          projectIds: selectedProjectIds,
          regions: selectedRegions,
          module: moduleName,
          signal: controller.signal,
          // Show rows as they arrive so a slow load doesn't look like a hung modal.
          onProgress: ({ deployments: loaded, incomplete: reason }) => {
            if (cancelled()) return;
            setAllDeployments(loaded);
            setIncomplete(reason);
          },
        });
      } catch (err) {
        if (!cancelled()) setError(err as Error);
      } finally {
        if (!cancelled()) setLoading(false);
      }
    };

    loadDeployments();
    return () => controller.abort();
  }, [open, selectedProjectIds, selectedRegions, moduleName, config]);

  // Filter deployments locally when version selection changes or deployments update.
  const deployments = React.useMemo(() => {
    let filtered = trackedDeployments;

    if (selectedTracks.length > 0) {
      filtered = filtered.filter((d) => selectedTracks.includes(d.module_track || ''));
    }

    if (selectedVersions.length > 0) {
      filtered = filtered.filter((d) => selectedVersions.includes(d.module_version || ''));
    }

    return filtered;
  }, [trackedDeployments, selectedVersions, selectedTracks]);

  const uniqueTracks = React.useMemo(
    () =>
      Array.from(
        new Set(
          trackedDeployments
            .map((d) => d.module_track)
            .filter(Boolean)
            .concat(allVersions.map((v) => v.track).filter(Boolean)),
        ),
      ) as string[],
    [trackedDeployments, allVersions],
  );

  // Publish dates, so the version filter can list the newest first.
  const versionTimestamps = React.useMemo(() => {
    const timestamps = new Map<string, number>();
    for (const mod of allVersions) {
      if (!mod.version || !mod.timestamp) continue;
      const epoch = new Date(mod.timestamp).getTime();
      if (Number.isNaN(epoch)) continue;
      timestamps.set(mod.version, Math.max(epoch, timestamps.get(mod.version) ?? -Infinity));
    }
    return timestamps;
  }, [allVersions]);

  const uniqueVersions = React.useMemo(() => {
    let filtered = trackedDeployments;
    let known = allVersions;

    if (selectedTracks.length > 0) {
      filtered = filtered.filter((d) => selectedTracks.includes(d.module_track || ''));
      known = known.filter((v) => selectedTracks.includes(v.track || ''));
    }

    const deploymentVersions = filtered.map((d) => d.module_version);
    const knownModuleVersions = known.map((v) => v.version);

    return (
      Array.from(
        new Set([...deploymentVersions, ...knownModuleVersions].filter(Boolean)),
      ) as string[]
    ).sort((a, b) => {
      const epochA = versionTimestamps.get(a);
      const epochB = versionTimestamps.get(b);
      // Versions seen only on a deployment have no publish date, so they go last.
      if (epochA === undefined && epochB === undefined)
        return b.localeCompare(a, undefined, { numeric: true });
      if (epochA === undefined) return 1;
      if (epochB === undefined) return -1;
      return epochB - epochA;
    });
  }, [trackedDeployments, selectedTracks, allVersions, versionTimestamps]);

  const deploymentColumns: TableColumn[] = [
    { title: 'Dep ID', field: 'deployment_id' },
    { title: 'Account', field: 'account_name' },
    { title: 'Environment', field: 'environment' },
    { title: 'Region', field: 'region' },
    { title: 'Version', field: 'module_version' },
    { title: 'Status', field: 'status' },
  ];

  const getDeploymentsData = () => {
    return deployments.map((d) => {
      const project = projects.find((p) => p.project_id === d.project_id);
      const encodedEnvironment = encodeURIComponent(d.environment ?? '');
      const encodedDeploymentId = encodeURIComponent(d.deployment_id ?? '');
      const deployment_link = `/infraweave/deployment/${d.project_id}/${d.region}/${encodedEnvironment}/${encodedDeploymentId}/overview`;

      return {
        ...d,
        deployment_id: <Link to={deployment_link}>{d.deployment_id}</Link>,
        account_name: project ? project.name : d.project_id,
        module_version: <VersionCell version={d.module_version} />,
      };
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Deployments
            {selectedVersions.length === 1 && ` using version ${selectedVersions[0]}`}
          </Typography>
          <IconButton onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mb: 2, mt: 1 }}>
          <Grid size={3}>
            <Autocomplete
              multiple
              options={projects}
              getOptionLabel={(option) => option.name || option.project_id}
              value={projects.filter((p) => selectedProjectIds.includes(p.project_id))}
              onChange={(_, newValue) => {
                setSelectedProjectIds(newValue.map((p) => p.project_id));
              }}
              renderInput={(params) => (
                <TextField {...params} label="Projects" variant="outlined" size="small" />
              )}
            />
          </Grid>
          <Grid size={3}>
            <Autocomplete
              multiple
              options={availableRegions}
              value={selectedRegions}
              onChange={(_, newValue) => {
                setSelectedRegions(newValue);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Regions" variant="outlined" size="small" />
              )}
            />
          </Grid>
          <Grid size={3}>
            <Autocomplete
              multiple
              options={uniqueTracks}
              value={selectedTracks}
              onChange={(_, newValue) => {
                setSelectedTracks(newValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tracks"
                  variant="outlined"
                  size="small"
                  helperText="Cleared = All tracks"
                />
              )}
            />
          </Grid>
          <Grid size={3}>
            <Autocomplete
              multiple
              options={uniqueVersions}
              value={selectedVersions}
              onChange={(_, newValue) => {
                setSelectedVersions(newValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Versions"
                  variant="outlined"
                  size="small"
                  helperText="Cleared = All versions"
                />
              )}
            />
          </Grid>
        </Grid>

        {(projectsLoading || loading) && allDeployments.length === 0 && <Progress />}
        {error && <ResponseErrorPanel error={error} />}
        {!error && allDeployments.length > 0 && (
          <Table
            // "N of M" when filtered, so a small count doesn't read as a load that came up short.
            title={
              deployments.length === trackedDeployments.length
                ? `Deployments (${deployments.length})`
                : `Deployments (${deployments.length} of ${trackedDeployments.length})`
            }
            options={{
              search: true,
              paging: true,
              pageSize: DEPLOYMENTS_PAGE_SIZE,
              pageSizeOptions: DEPLOYMENTS_PAGE_SIZES,
              emptyRowsWhenPaging: false,
            }}
            columns={deploymentColumns}
            data={getDeploymentsData()}
            emptyContent={
              loading
                ? 'No deployments match the current filters yet.'
                : 'No deployments match the current filters.'
            }
          />
        )}
        {!error && loading && allDeployments.length > 0 && (
          <LoadingMore label="Loading more deployments..." />
        )}
        {!error && !loading && incomplete && (
          <ListIncomplete label="deployments" reason={INCOMPLETE_REASON_TEXT[incomplete]} />
        )}
        {/* A short list already says why it may be empty. */}
        {!error && !projectsLoading && !loading && !incomplete && allDeployments.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {selectedProjectIds.length === 0 || selectedRegions.length === 0
              ? 'Select at least one project and one region to see deployments.'
              : `No deployments found for this ${resourceType}.`}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const ModuleVersions = ({
  module,
  track,
  hideChanges = false,
  hideTitle = false,
  allTracks = false,
  onVersionClick,
  resourceType = 'module',
  onCompare,
}: {
  module?: string;
  track?: string;
  hideChanges?: boolean;
  hideTitle?: boolean;
  allTracks?: boolean;
  onVersionClick?: () => void;
  resourceType?: 'module' | 'stack';
  onCompare?: (version: string, track?: string) => void;
}) => {
  const config = useConfig();
  const [includeDev000, setIncludeDev000] = useState(false);
  const [includeDeprecated, setIncludeDeprecated] = useState(false);

  const { value, loading, error } = useAsync(async (): Promise<Module[]> => {
    const fields = [
      'module',
      'module_name',
      'track',
      'version',
      'deprecated',
      'timestamp',
      's3_key',
      ...(hideChanges ? [] : ['version_diff']),
    ].join(',');
    const queryParams = `include_dev000=${includeDev000}&include_deprecated=${includeDeprecated}&fields=${fields}`;

    if (allTracks) {
      // Fetch versions from all tracks
      const allVersions: Module[] = [];

      for (const t of TRACKS) {
        try {
          let url = config.getApiUrl(
            `api/proxy/api/infraweave/api/v1/${resourceType}s/versions/${t}/${module}`,
          );
          url += (url.includes('?') ? '&' : '?') + queryParams;

          const response = await config.fetch(url);

          if (response.ok) {
            const json = await response.json();
            const items = json.Items || json.items || json;
            if (Array.isArray(items)) {
              allVersions.push(...items);
            }
          }
        } catch (_err) {
          // No versions found for this track
        }
      }

      return allVersions;
    }

    let url = config.getApiUrl(
      `api/proxy/api/infraweave/api/v1/${resourceType}s/versions/${track}/${module}`,
    );
    url += (url.includes('?') ? '&' : '?') + queryParams;

    const response = await config.fetch(url);

    if (response.status >= 300 && response.status < 400) {
      throw new Error('Redirected to login or guest page');
    }

    const json = await response.json();

    return json.Items || json.items || json;
  }, [track, module, allTracks, resourceType, includeDev000, includeDeprecated]);

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <>
      <DenseTable
        modules={value || []}
        hideChanges={hideChanges}
        hideTitle={hideTitle}
        showTrack={allTracks}
        onVersionClick={onVersionClick}
        resourceType={resourceType}
        onCompare={onCompare}
        moduleName={module}
        includeDev000={includeDev000}
        onIncludeDev000Change={setIncludeDev000}
        includeDeprecated={includeDeprecated}
        onIncludeDeprecatedChange={setIncludeDeprecated}
      />
    </>
  );
};
