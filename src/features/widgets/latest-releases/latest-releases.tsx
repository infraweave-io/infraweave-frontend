import React from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Link, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { ListIncomplete } from '../../../shared/components/ListIncomplete';
import { SearchField } from '../../../shared/components/SearchField';
import { useConfig } from '../../../hooks/useConfig';
import { useCachedQuery } from '../../../utils/queryCache';
import { fetchAllRegistryPages } from '../../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { Module } from '../../../types/Module';
import { shortenVersion } from '../../../utils/version';
import { bestFuzzyScore } from '../../../utils/fuzzyMatch';
import { ago } from '../../../utils/format';
import { trackRank } from '../../../utils/tracks';
import { useWidgetSetting } from '../widgetSettings';
import { useOnWidgetReload } from '../widgetReload';

/** A widget is a preview; every version lives on the Modules and Stacks tabs. */
const MAX_ROWS = 8;

const FIELDS = 'fields=module,module_name,track,version,timestamp';
const MODULES_PATH = `api/proxy/api/infraweave/api/v1/modules?${FIELDS}`;
const STACKS_PATH = `api/proxy/api/infraweave/api/v1/stacks?${FIELDS}`;

type Kind = 'module' | 'stack';

type KindFilter = 'all' | Kind;

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'Modules & stacks' },
  { value: 'module', label: 'Modules' },
  { value: 'stack', label: 'Stacks' },
];

type Release = {
  kind: Kind;
  name: string;
  displayName: string;
  track: string;
  version: string;
  /** Epoch ms, or 0 when the record has no timestamp. */
  publishedAt: number;
};

const releaseLink = (release: Release) =>
  `/infraweave/${release.kind}/${release.track}/${encodeURIComponent(
    release.name,
  )}/${encodeURIComponent(release.version)}`;

const NO_ITEMS: Module[] = [];

/** One registry list, through the query cache so a remount within a few minutes draws at once. */
const useRegistryList = (path: string) => {
  const config = useConfig();
  const { data, loading, error, reload } = useCachedQuery(path, () =>
    fetchAllRegistryPages(config, path),
  );
  return {
    items: data?.items ?? NO_ITEMS,
    loading,
    error,
    truncated: data ? !data.complete : false,
    reload,
  };
};

const toReleases = (items: Module[], kind: Kind): Release[] =>
  items
    .filter((item) => (item.module || item.module_name) && item.version && item.track)
    .map((item) => {
      const time = item.timestamp ? new Date(item.timestamp).getTime() : 0;
      return {
        kind,
        name: item.module || item.module_name,
        displayName: item.module_name || item.module,
        track: item.track,
        version: item.version,
        publishedAt: Number.isNaN(time) ? 0 : time,
      };
    });

/**
 * The most recently published module and stack versions. The registry lists the latest
 * version of each track, so each row is the newest release of one module on one track.
 */
export const LatestReleasesList = () => {
  const modules = useRegistryList(MODULES_PATH);
  const stacks = useRegistryList(STACKS_PATH);
  useOnWidgetReload(() => Promise.all([modules.reload(), stacks.reload()]));

  const releases = React.useMemo(() => {
    // Keep one row per module and track, the newest, in case a list carries older versions.
    const newest = new Map<string, Release>();
    for (const release of [
      ...toReleases(modules.items, 'module'),
      ...toReleases(stacks.items, 'stack'),
    ]) {
      const key = `${release.kind}:${release.name}:${release.track}`;
      const current = newest.get(key);
      if (!current || release.publishedAt > current.publishedAt) newest.set(key, release);
    }
    return Array.from(newest.values()).sort(
      (a, b) => b.publishedAt - a.publishedAt || a.displayName.localeCompare(b.displayName),
    );
  }, [modules.items, stacks.items]);

  const [query, setQuery] = React.useState('');
  // The filters are kept for next time; the search is not.
  const [storedKind, setKind] = useWidgetSetting<KindFilter>('kind', 'all');
  const [storedTrack, setTrack] = useWidgetSetting<string>('track', 'all');

  // Only tracks something was published on, so no option leads to an empty list.
  const tracks = React.useMemo(
    () =>
      Array.from(new Set(releases.map((release) => release.track))).sort(
        (a, b) => trackRank(a) - trackRank(b) || a.localeCompare(b),
      ),
    [releases],
  );

  // A kept filter can be stale: a track nothing is published on any more, or an edited value.
  const kind = KIND_OPTIONS.some((option) => option.value === storedKind) ? storedKind : 'all';
  const track = tracks.includes(storedTrack) ? storedTrack : 'all';

  const searching = query.trim() !== '';
  const filtering = searching || kind !== 'all' || track !== 'all';

  const matches = React.useMemo(() => {
    const narrowed = releases.filter(
      (release) =>
        (kind === 'all' || release.kind === kind) && (track === 'all' || release.track === track),
    );
    if (!searching) return narrowed;
    // Both names are searchable, as on the Modules tab. Best match first, and among equally
    // good matches (one module's tracks) the newest release first. The sort is stable, so
    // `narrowed` keeps its newest-first order within a score.
    return narrowed
      .map((release) => ({
        release,
        score: bestFuzzyScore(query, [release.displayName, release.name]),
      }))
      .filter((entry): entry is { release: Release; score: number } => entry.score !== null)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.release);
  }, [releases, kind, track, query, searching]);

  const clearFilters = () => {
    setQuery('');
    setKind('all');
    setTrack('all');
  };

  // Rows would reorder as pages arrive, so wait for both lists before drawing.
  if (modules.loading || stacks.loading) {
    return (
      <Stack spacing={1} aria-busy="true" aria-label="Loading latest releases">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={40} />
        ))}
      </Stack>
    );
  }

  if (modules.error && stacks.error && releases.length === 0) {
    return <ResponseErrorPanel error={modules.error} title="Could not load releases" />;
  }

  // One list failing still leaves the other worth showing, as long as the gap is named.
  const missing = [modules.error && 'modules', stacks.error && 'stacks'].filter(Boolean);
  const truncated = [modules.truncated && 'modules', stacks.truncated && 'stacks'].filter(Boolean);

  return (
    <Box>
      {missing.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {`The ${missing.join(' and ')} could not be loaded, so ${
            missing.length === 1 ? 'those releases are' : 'releases are'
          } missing from this list.`}
        </Alert>
      )}

      {releases.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No modules or stacks have been published yet.
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search releases"
              sx={{ flex: '1 1 100%' }}
            />
            <TextField
              select
              size="small"
              label="Type"
              value={kind}
              onChange={(event) => setKind(event.target.value as KindFilter)}
              sx={{ flex: '1 1 0', minWidth: 140 }}
            >
              {KIND_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Track"
              value={track}
              onChange={(event) => setTrack(event.target.value)}
              sx={{ flex: '1 1 0', minWidth: 110 }}
            >
              <MenuItem value="all">All tracks</MenuItem>
              {tracks.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Mounted with the filters; a live region added with its text is often not read. */}
          <Typography
            role="status"
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ minHeight: '1.5em' }}
          >
            {filtering &&
              (matches.length > MAX_ROWS
                ? `Showing ${MAX_ROWS} of ${matches.length} matching releases`
                : `${matches.length} matching ${matches.length === 1 ? 'release' : 'releases'}`)}
          </Typography>

          {matches.length === 0 ? (
            <Box sx={{ py: 1 }}>
              <Typography variant="body2" color="text.secondary">
                No releases match these filters.
              </Typography>
              <Button size="small" onClick={clearFilters} sx={{ mt: 0.5, ml: -0.5 }}>
                Clear filters
              </Button>
            </Box>
          ) : (
            <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
              {matches.slice(0, MAX_ROWS).map((release) => (
                <Box
                  key={`${release.kind}:${release.name}:${release.track}`}
                  sx={{ py: 1, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}
                >
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                      <Link to={releaseLink(release)}>{release.displayName}</Link>
                    </Typography>
                    <Tooltip title={release.version} placement="bottom-start">
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {shortenVersion(release.version)}
                      </Typography>
                    </Tooltip>
                  </Box>
                  {release.kind === 'stack' && (
                    <Chip label="stack" size="small" variant="outlined" />
                  )}
                  <Chip label={release.track} size="small" variant="outlined" />
                  {release.publishedAt > 0 && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      title={new Date(release.publishedAt).toLocaleString()}
                      sx={{ flexShrink: 0, minWidth: 56, textAlign: 'right' }}
                    >
                      {ago(release.publishedAt)}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </>
      )}

      {truncated.length > 0 && (
        <ListIncomplete label={truncated.join(' and ')} reason="stopped before the end" />
      )}
    </Box>
  );
};
