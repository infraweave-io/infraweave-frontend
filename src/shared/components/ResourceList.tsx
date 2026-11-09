import React, { useEffect, useMemo, useState } from 'react';
import { Table, TableColumn, Link } from '../../standalone/components/ComponentAdapter';
import { Module } from '../../types/Module';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Skeleton,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { MONO_FONT } from '../../contexts/ThemeContext';
import { shortenVersion } from '../../utils/version';
import { readCachedNames, writeCachedNames } from '../../utils/resourceNameCache';

type ResourceListProps = {
  items: Module[];
  resourceType: 'module' | 'stack';
  /**
   * True while further pages are still arriving. Lets the table draw rows for
   * names it remembers from a previous visit, so the list doesn't grow under
   * the user's cursor.
   */
  loading?: boolean;
  /**
   * True when loading stopped with pages outstanding, so `items` is incomplete.
   * Prevents the shrunken name set from being remembered as the whole registry.
   */
  truncated?: boolean;
  /**
   * Set when the load failed. Distinguishes "empty because nothing loaded" from
   * "empty because the registry is empty" — only the latter may evict the cache.
   */
  error?: Error;
  /** Optional table caption. Omit when the page heading already names the list. */
  title?: string;
  VersionsComponent: React.ComponentType<{
    module?: string;
    track?: string;
    hideChanges?: boolean;
    hideTitle?: boolean;
  }>;
};

type ResourceRow = {
  module: string;
  module_name: string;
  stable_version: string;
  beta_version: string;
  alpha_version: string;
  dev_version: string;
  /**
   * The name came from the cache and no data for it has arrived yet, so its
   * versions are unknown — as opposed to known to be absent.
   */
  pending?: boolean;
};

// Rows arrive page by page and the API orders them by track before name (the
// DynamoDB sort key is `MODULE#<track>::<module>`), so without an explicit sort
// every new page reshuffles rows the user is already looking at. Sort on the
// name that is actually rendered.
const byDisplayName = (a: ResourceRow, b: ResourceRow) =>
  a.module_name.localeCompare(b.module_name, undefined, { sensitivity: 'base' });

const groupResourcesByName = (modules: Module[]): ResourceRow[] => {
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

  return Object.entries(groupedResources)
    .map(([moduleName, data]) => ({
      module: moduleName,
      module_name: data.module_name || moduleName,
      stable_version: data.tracks.stable || '',
      beta_version: data.tracks.beta || '',
      alpha_version: data.tracks.alpha || '',
      dev_version: data.tracks.dev || '',
    }))
    .sort(byDisplayName);
};

export const ResourceList = ({
  items: modules,
  resourceType,
  loading = false,
  truncated = false,
  error,
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

  const loadedRows = useMemo(() => groupResourcesByName(modules), [modules]);

  // Remember the names once the whole list has arrived, so the next visit can
  // draw every row up front. Keyed on the name set, otherwise this writes
  // storage on every render.
  const loadedNameKey = loadedRows.map((row) => row.module).join(',');
  useEffect(() => {
    // Only a complete, successful load may be remembered. A mid-load snapshot, a
    // failure, or a load that stopped with pages outstanding would all persist a
    // subset — and every later visit would then start from that subset, turning a
    // transient truncation into a permanent one.
    // A genuinely empty registry does write `[]`: gating on the row count instead
    // would leave deleted modules rendering as pending rows for good.
    if (loading || truncated || error) return;
    writeCachedNames(
      resourceType,
      loadedRows.map(({ module, module_name }) => ({ module, module_name })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, truncated, error, resourceType, loadedNameKey]);

  // Read once per mount: re-reading as pages land would resurrect rows that the
  // registry has since dropped.
  const cachedNames = useMemo(() => readCachedNames(resourceType), [resourceType]);

  const rows = useMemo(() => {
    if (!loading) return loadedRows;

    const loaded = new Set(loadedRows.map((row) => row.module));
    const pending: ResourceRow[] = cachedNames
      .filter((name) => !loaded.has(name.module))
      .map((name) => ({
        ...name,
        stable_version: '',
        beta_version: '',
        alpha_version: '',
        dev_version: '',
        pending: true,
      }));

    return pending.length > 0 ? [...loadedRows, ...pending].sort(byDisplayName) : loadedRows;
  }, [cachedNames, loadedRows, loading]);

  const data = rows.map((resource) => {
    // The API returns one record per (module, track) and these rows collapse them,
    // so a page boundary can fall between two tracks of the same module: a row can
    // be present and still be missing tracks. While pages are arriving no row's
    // track set is complete, so every row is treated as unresolved, not just the
    // ones drawn purely from the cache.
    const tracksUnknown = resource.pending || loading;

    const availableTracks = [
      resource.stable_version ? 'stable' : null,
      resource.beta_version ? 'beta' : null,
      resource.alpha_version ? 'alpha' : null,
      resource.dev_version ? 'dev' : null,
    ].filter(Boolean) as string[];

    // Versions are machine-generated identifiers, so they get the mono stack;
    // a dash makes "no version on this track" explicit rather than blank.
    // The label is elided (dev builds append a 40-char sha) but the link still
    // carries the full version, and the tooltip shows it.
    // `describeChild` renders a real `title` attribute on the child rather than an
    // aria-label on the role-less span, which screen readers ignore — without it
    // the full version is reachable by mouse only.
    const versionCell = (track: string, version: string) =>
      version ? (
        <Tooltip title={version} arrow placement="top" describeChild>
          {/* The span is what Tooltip attaches its ref and handlers to; Link
              does not forward a ref. */}
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            <Link
              to={`/infraweave/${resourceType}/${track}/${encodeURIComponent(
                resource.module,
              )}/${encodeURIComponent(version)}`}
              style={{ fontFamily: MONO_FONT }}
            >
              {shortenVersion(version)}
            </Link>
          </Box>
        </Tooltip>
      ) : tracksUnknown ? (
        // No version for this track *yet*: either the row came from the cache, or
        // the page carrying this track hasn't arrived. A dash would read as "no
        // version on this track", which isn't known until loading finishes.
        <Skeleton variant="text" width={90} aria-label="loading version" />
      ) : (
        <Box component="span" sx={{ color: 'text.disabled' }}>
          &mdash;
        </Box>
      );

    const nameButton = (
      // A real <button>: this opens the versions dialog, so it has to be
      // reachable by keyboard, which the previous clickable <span> was not.
      // Disabled until the track set is known: the dialog's track switcher is
      // built from the versions we have, and offering it before they all arrive
      // would either hide tracks that exist or advertise tracks that don't.
      <Box
        component="button"
        type="button"
        disabled={tracksUnknown}
        sx={{
          background: 'none',
          border: 0,
          p: 0,
          font: 'inherit',
          fontWeight: 600,
          color: tracksUnknown ? 'text.secondary' : 'text.primary',
          cursor: tracksUnknown ? 'default' : 'pointer',
          textAlign: 'left',
          '&:hover': tracksUnknown
            ? undefined
            : {
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
    );

    return {
      module: tracksUnknown ? (
        // A `title` on a disabled control never shows — browsers suppress its mouse
        // events — which left the greyed-out name unexplained. The span is what
        // takes the tooltip's handlers instead.
        <Tooltip title="Loading versions…" arrow placement="top">
          <Box component="span" sx={{ display: 'inline-block' }}>
            {nameButton}
          </Box>
        </Tooltip>
      ) : (
        nameButton
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
