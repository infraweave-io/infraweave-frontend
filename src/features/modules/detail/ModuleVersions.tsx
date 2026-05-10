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
import useAsync from 'react-use/lib/useAsync';
import { Module } from '../../../types/Module';
import { ChangesTags } from './VersionDiff';
import { Deployment } from '../../../types/Deployment';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import { VersionCell } from '../../../shared/components/VersionCell';

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

    const module_link = `/infraweave/module/${track}/${encodedModuleName}/${encodedModuleVersion}`;
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
                {hideTitle ? '' : 'Module Versions'}
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
              Deployments using this module
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
  knownVersions = [],
}: {
  open: boolean;
  onClose: () => void;
  moduleName: string;
  version: string;
  knownVersions?: Module[];
}) => {
  const config = useConfig();
  const [projects, setProjects] = useState<any[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [allDeployments, setAllDeployments] = useState<Deployment[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
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

  // Fetch projects and regions on open
  React.useEffect(() => {
    if (open) {
      setLoading(true);
      config
        .fetch(config.getApiUrl('api/proxy/api/infraweave/api/v1/projects'))
        .then((response) => {
          if (!response.ok) throw new Error('Failed to fetch projects');
          return response.json();
        })
        .then((data) => {
          setProjects(data);
          const regions = Array.from(
            new Set(data.flatMap((p: any) => p.regions || [])),
          ) as string[];
          setAvailableRegions(regions);

          // Default select all
          setSelectedProjectIds(data.map((p: any) => p.project_id));
          setSelectedRegions(regions);
        })
        .catch((err) => setError(err))
        .finally(() => setLoading(false));
    }
  }, [open, config]);

  // Fetch deployments when filters change
  React.useEffect(() => {
    if (!open || selectedProjectIds.length === 0 || selectedRegions.length === 0) {
      if (open) setDeployments([]);
      return;
    }

    const fetchDeployments = async () => {
      setLoading(true);
      try {
        const projectIdsString = selectedProjectIds.join(',');

        // Group requests by region (similar to optimizations in Deployments.tsx)
        const fetchPromises = selectedRegions.map((region) =>
          config
            .fetch(
              config.getApiUrl(
                `api/proxy/api/infraweave/api/v1/deployments/module/${projectIdsString}/${region}/${encodeURIComponent(
                  moduleName,
                )}`,
              ),
            )
            .then((r) => (r.ok ? r.json() : []))
            .then((json) => (json.Items || json.items || json) as Deployment[])
            .catch((err) => {
              console.warn(`Failed to fetch deployments for region ${region}`, err);
              return [];
            }),
        );

        const results = await Promise.all(fetchPromises);
        const deploymentsFound = results.flat().map((d: Deployment) => {
          if (!d.module_track && knownVersions.length > 0) {
            const match = knownVersions.find((v) => v.version === d.module_version);
            if (match && match.track) {
              return { ...d, module_track: match.track };
            }
          }
          return d;
        });
        setAllDeployments(deploymentsFound);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeployments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedProjectIds, selectedRegions, moduleName, config]);

  // Filter deployments locally when version selection changes or deployments update
  React.useEffect(() => {
    let filtered = allDeployments;

    if (selectedTracks.length > 0) {
      filtered = filtered.filter((d) => selectedTracks.includes(d.module_track || ''));
    }

    if (selectedVersions.length > 0) {
      filtered = filtered.filter((d) => selectedVersions.includes(d.module_version || ''));
    }

    setDeployments(filtered);
  }, [allDeployments, selectedVersions, selectedTracks]);

  const uniqueTracks = React.useMemo(() => {
    if (knownVersions.length > 0) {
      return Array.from(
        new Set(
          allDeployments
            .map((d) => d.module_track)
            .filter(Boolean)
            .concat(knownVersions.map((v) => v.track).filter(Boolean)),
        ),
      ) as string[];
    }
    return Array.from(
      new Set(allDeployments.map((d) => d.module_track).filter(Boolean)),
    ) as string[];
  }, [allDeployments, knownVersions]);

  const uniqueVersions = React.useMemo(() => {
    let filtered = allDeployments;
    let known = knownVersions;

    if (selectedTracks.length > 0) {
      filtered = filtered.filter((d) => selectedTracks.includes(d.module_track || ''));
      known = known.filter((v) => selectedTracks.includes(v.track || ''));
    }

    const deploymentVersions = filtered.map((d) => d.module_version);
    const knownModuleVersions = known.map((v) => v.version);

    return Array.from(
      new Set([...deploymentVersions, ...knownModuleVersions].filter(Boolean)),
    ) as string[];
  }, [allDeployments, selectedTracks, knownVersions]);

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

        {loading && <Progress />}
        {error && <ResponseErrorPanel error={error} />}
        {!loading && !error && (
          <Table
            title={`Deployments (${deployments?.length || 0})`}
            options={{ search: true, paging: false }}
            columns={deploymentColumns}
            data={getDeploymentsData()}
          />
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
      const tracks = ['stable', 'beta', 'alpha', 'dev'];
      const allVersions: Module[] = [];

      for (const t of tracks) {
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
