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
import { MONO_FONT } from '../../contexts/ThemeContext';

type ResourceListProps = {
  items: Module[];
  resourceType: 'module' | 'stack';
  /** Optional table caption. Omit when the page heading already names the list. */
  title?: string;
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

    // Versions are machine-generated identifiers, so they get the mono stack;
    // a dash makes "no version on this track" explicit rather than blank.
    const versionCell = (track: string, version: string) =>
      version ? (
        <Link
          to={`/infraweave/${resourceType}/${track}/${encodeURIComponent(
            resource.module,
          )}/${encodeURIComponent(version)}`}
          style={{ fontFamily: MONO_FONT }}
        >
          {version}
        </Link>
      ) : (
        <Box component="span" sx={{ color: 'text.disabled' }}>
          &mdash;
        </Box>
      );

    return {
      module: (
        // A real <button>: this opens the versions dialog, so it has to be
        // reachable by keyboard, which the previous clickable <span> was not.
        <Box
          component="button"
          type="button"
          sx={{
            background: 'none',
            border: 0,
            p: 0,
            font: 'inherit',
            fontWeight: 600,
            color: 'text.primary',
            cursor: 'pointer',
            textAlign: 'left',
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
          {resource.module_name}
        </Box>
      ),
      stable_version: versionCell('stable', resource.stable_version),
      beta_version: versionCell('beta', resource.beta_version),
      alpha_version: versionCell('alpha', resource.alpha_version),
      dev_version: versionCell('dev', resource.dev_version),
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
