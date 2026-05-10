import React, { useState } from 'react';
import { Table, TableColumn, Link } from '../../standalone/components/ComponentAdapter';
import { Module } from '../../types/Module';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

type ResourceListProps = {
  items: Module[];
  resourceType: 'module' | 'stack';
  title: string;
  VersionsComponent: React.ComponentType<{
    module?: string;
    track?: string;
    hideChanges?: boolean;
    hideTitle?: boolean;
  }>;
};

const groupResourcesByName = (modules: Module[]) => {
  const groupedResources = modules.reduce(
    (acc: { [key: string]: { tracks: { [key: string]: string }; module_name?: string } }, mod) => {
      if (!acc[mod.module]) {
        acc[mod.module] = { tracks: {}, module_name: mod.module_name };
      }
      acc[mod.module].tracks[mod.track] = mod.version;
      if (mod.module_name && !acc[mod.module].module_name) {
        acc[mod.module].module_name = mod.module_name;
      }
      return acc;
    },
    {},
  );

  return Object.entries(groupedResources).map(([moduleName, data]) => ({
    module: moduleName,
    module_name: data.module_name || moduleName,
    stable_version: data.tracks.stable || '',
    beta_version: data.tracks.beta || '',
    alpha_version: data.tracks.alpha || '',
    dev_version: data.tracks.dev || '',
  }));
};

export const ResourceList = ({
  items: modules,
  resourceType,
  title,
  VersionsComponent,
}: ResourceListProps) => {
  const [selectedResource, setSelectedResource] = useState<{
    name: string;
    displayName: string;
    availableTracks: string[];
  } | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<string>('stable');

  const columns: TableColumn[] = [
    { title: resourceType === 'module' ? 'Module' : 'Stack', field: 'module' },
    { title: 'Latest Stable Version', field: 'stable_version' },
    { title: 'Latest Beta Version', field: 'beta_version' },
    { title: 'Latest Alpha Version', field: 'alpha_version' },
    { title: 'Latest Dev Version', field: 'dev_version' },
  ];

  const data = groupResourcesByName(modules).map((resource) => {
    const availableTracks = [
      resource.stable_version ? 'stable' : null,
      resource.beta_version ? 'beta' : null,
      resource.alpha_version ? 'alpha' : null,
      resource.dev_version ? 'dev' : null,
    ].filter(Boolean) as string[];

    return {
      module: (
        <Box
          component="span"
          sx={{
            cursor: 'pointer',
            '&:hover': {
              textDecoration: 'underline',
              color: 'primary.main',
            },
          }}
          onClick={() => {
            setSelectedResource({
              name: resource.module,
              displayName: resource.module_name,
              availableTracks,
            });
            setSelectedTrack(availableTracks[0] || 'stable');
          }}
        >
          <b>{resource.module_name}</b>
        </Box>
      ),
      stable_version: resource.stable_version ? (
        <Link
          to={`/infraweave/${resourceType}/stable/${encodeURIComponent(
            resource.module,
          )}/${encodeURIComponent(resource.stable_version)}`}
        >
          {resource.stable_version}
        </Link>
      ) : (
        ''
      ),
      beta_version: resource.beta_version ? (
        <Link
          to={`/infraweave/${resourceType}/beta/${encodeURIComponent(
            resource.module,
          )}/${encodeURIComponent(resource.beta_version)}`}
        >
          {resource.beta_version}
        </Link>
      ) : (
        ''
      ),
      alpha_version: resource.alpha_version ? (
        <Link
          to={`/infraweave/${resourceType}/alpha/${encodeURIComponent(
            resource.module,
          )}/${encodeURIComponent(resource.alpha_version)}`}
        >
          {resource.alpha_version}
        </Link>
      ) : (
        ''
      ),
      dev_version: resource.dev_version ? (
        <Link
          to={`/infraweave/${resourceType}/dev/${encodeURIComponent(
            resource.module,
          )}/${encodeURIComponent(resource.dev_version)}`}
        >
          {resource.dev_version}
        </Link>
      ) : (
        ''
      ),
    };
  });

  return (
    <>
      <Table
        title={title}
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
        open={selectedResource !== null}
        onClose={() => setSelectedResource(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{selectedResource?.displayName} - Versions</Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => setSelectedResource(null)}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedResource && (
            <>
              <Box
                mb={2}
                display="flex"
                flexDirection="column"
                alignItems="center"
                sx={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'background.paper',
                  zIndex: 3,
                  paddingTop: 2,
                  paddingBottom: 2,
                }}
              >
                <Typography variant="body2" color="text.secondary" mb={1}>
                  Track (maturity level)
                </Typography>
                <ToggleButtonGroup
                  value={selectedTrack}
                  exclusive
                  onChange={(_, newTrack) => {
                    if (newTrack !== null) {
                      setSelectedTrack(newTrack);
                    }
                  }}
                  aria-label="track selection"
                >
                  {selectedResource.availableTracks.includes('stable') && (
                    <ToggleButton value="stable" aria-label="stable">
                      Stable
                    </ToggleButton>
                  )}
                  {selectedResource.availableTracks.includes('beta') && (
                    <ToggleButton value="beta" aria-label="beta">
                      Beta
                    </ToggleButton>
                  )}
                  {selectedResource.availableTracks.includes('alpha') && (
                    <ToggleButton value="alpha" aria-label="alpha">
                      Alpha
                    </ToggleButton>
                  )}
                  {selectedResource.availableTracks.includes('dev') && (
                    <ToggleButton value="dev" aria-label="dev">
                      Dev
                    </ToggleButton>
                  )}
                </ToggleButtonGroup>
              </Box>
              <VersionsComponent
                module={selectedResource.name}
                track={selectedTrack}
                hideChanges
                hideTitle
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
