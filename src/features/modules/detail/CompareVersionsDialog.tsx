import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Divider,
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Module, VersionDiff } from '../../../types/Module';
import { useConfig } from '../../../hooks/useConfig';
import { Progress, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { compareZips } from '../../../utils/zipDiff';
import { ZipDiffBrowser } from '../../../shared/components/ZipDiffBrowser';

interface CompareVersionsDialogProps {
  open: boolean;
  onClose: () => void;
  currentModule: Module;
  resourceType?: 'module' | 'stack';
  initialCompareVersion?: string;
  initialCompareTrack?: string;
}

interface DiffItem {
  key: string;
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  oldValue?: any;
  newValue?: any;
}

export const CompareVersionsDialog = ({
  open,
  onClose,
  currentModule,
  resourceType = 'module',
  initialCompareVersion,
  initialCompareTrack,
}: CompareVersionsDialogProps) => {
  const config = useConfig();
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [selectedTrack, setSelectedTrack] = useState<string>(
    initialCompareTrack || currentModule.track || 'stable',
  );
  const [versions, setVersions] = useState<Module[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState<Module | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [showFileChanges, setShowFileChanges] = useState(false);
  const [fileDiff, setFileDiff] = useState<VersionDiff | null>(null);
  const [loadingFileDiff, setLoadingFileDiff] = useState(false);
  const [fileDiffError, setFileDiffError] = useState<string | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      if (initialCompareTrack) {
        setSelectedTrack(initialCompareTrack);
      } else {
        setSelectedTrack(currentModule.track || 'stable');
      }
    }
  }, [open, initialCompareTrack, currentModule.track]);

  // Fetch available versions
  useEffect(() => {
    if (open && currentModule) {
      const fetchVersions = async () => {
        setLoadingVersions(true);
        try {
          // Use the track that is about to be set or currently set
          const trackToUse = initialCompareTrack && open ? initialCompareTrack : selectedTrack;

          // If we just opened and have an initial track, but state hasn't updated yet,
          // we might have a race condition if we use selectedTrack directly.
          // However, the previous useEffect should update selectedTrack, which triggers this effect again.
          // To be safe, rely on selectedTrack but ensure we don't fetch with stale state if possible.

          const response = await config.fetch(
            config.getApiUrl(
              `api/proxy/api/infraweave/api/v1/${resourceType}s/versions/${trackToUse}/${
                currentModule.module || currentModule.module_name
              }`,
            ),
          );

          if (response.ok) {
            const json = await response.json();
            const items = json.Items || json.items || json;
            // Filter out current version only if tracks match
            const otherVersions = (Array.isArray(items) ? items : []).filter(
              (v: Module) =>
                trackToUse !== currentModule.track || v.version !== currentModule.version,
            );
            setVersions(otherVersions);

            if (
              initialCompareVersion &&
              otherVersions.some((v: Module) => v.version === initialCompareVersion)
            ) {
              setSelectedVersion(initialCompareVersion);
            } else if (otherVersions.length > 0) {
              // Only default to first version if we're not currently targeted on initialCompareVersion's track mismatch
              if (!initialCompareVersion) {
                setSelectedVersion(otherVersions[0].version);
              } else {
                // If initial version is set but not found in this track (yet?), check if track matches
                // If we switched track, maybe we should select first.
                // But if we have initialCompareVersion, keep it in mind.
                if (trackToUse === initialCompareTrack) {
                  // We expect it to be here. If not, maybe fallback to first.
                  setSelectedVersion(otherVersions[0]?.version || '');
                } else {
                  setSelectedVersion(otherVersions[0]?.version || '');
                }
              }
            } else {
              setSelectedVersion('');
            }
          }
        } catch (err) {
          console.error('Error fetching versions:', err);
          setError(err as Error);
        } finally {
          setLoadingVersions(false);
        }
      };

      fetchVersions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentModule, config, resourceType, initialCompareVersion, selectedTrack]);

  // Fetch selected version data
  useEffect(() => {
    if (selectedVersion && currentModule) {
      const fetchComparisonData = async () => {
        setLoadingComparison(true);
        try {
          const encodedName = encodeURIComponent(
            currentModule.module || currentModule.module_name || '',
          );
          const encodedVersion = encodeURIComponent(selectedVersion);

          const response = await config.fetch(
            config.getApiUrl(
              `api/proxy/api/infraweave/api/v1/${resourceType}/${selectedTrack}/${encodedName}/${encodedVersion}`,
            ),
          );

          if (response.ok) {
            const json = await response.json();
            setComparisonData(json);
          }
        } catch (err) {
          console.error('Error fetching comparison data:', err);
          setError(err as Error);
        } finally {
          setLoadingComparison(false);
        }
      };

      fetchComparisonData();
      // Reset file diff when version changes
      setFileDiff(null);
      setFileDiffError(null);
    }
  }, [selectedVersion, selectedTrack, currentModule, config, resourceType]);

  // Calculate file diffs when requested
  useEffect(() => {
    if (
      showFileChanges &&
      selectedVersion &&
      currentModule &&
      !fileDiff &&
      !loadingFileDiff &&
      !fileDiffError
    ) {
      const fetchAndCompareZips = async () => {
        setLoadingFileDiff(true);
        setFileDiffError(null);
        try {
          const name = currentModule.module || currentModule.module_name || '';

          const baseUrl = `api/proxy/api/infraweave/api/v1/${resourceType}`;
          const currentUrl = config.getApiUrl(
            `${baseUrl}/${currentModule.track}/${encodeURIComponent(name)}/${encodeURIComponent(
              currentModule.version,
            )}/download`,
          );
          const selectedUrl = config.getApiUrl(
            `${baseUrl}/${selectedTrack}/${encodeURIComponent(name)}/${encodeURIComponent(
              selectedVersion,
            )}/download`,
          );

          const fetchZip = async (url: string) => {
            const response = await config.fetch(url);
            if (!response.ok) {
              throw new Error(
                `Failed to fetch zip from ${url}: ${response.status} ${response.statusText}`,
              );
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = await response.json();
              const downloadUrl =
                data.url || data.download_url || data.s3_url || data.presigned_url || data.link;

              if (downloadUrl) {
                const downloadRes = await fetch(downloadUrl);
                if (!downloadRes.ok)
                  throw new Error(`Failed to download from storage: ${downloadRes.status}`);
                return downloadRes.blob();
              }

              console.error('Received JSON instead of Zip:', data);
              throw new Error(
                'Server returned JSON instead of Zip file, and no download URL was found.',
              );
            }

            return response.blob();
          };

          const [currentBlob, selectedBlob] = await Promise.all([
            fetchZip(currentUrl),
            fetchZip(selectedUrl),
          ]);

          const currentZip = await JSZip.loadAsync(currentBlob);
          const selectedZip = await JSZip.loadAsync(selectedBlob);

          const diff = await compareZips(currentZip, selectedZip, selectedVersion);
          setFileDiff(diff);
        } catch (err) {
          console.error('Error comparing zips:', err);
          setFileDiffError(err instanceof Error ? err.message : 'Failed to compare versions');
        } finally {
          setLoadingFileDiff(false);
        }
      };

      fetchAndCompareZips();
    }
  }, [
    showFileChanges,
    selectedVersion,
    currentModule,
    config,
    resourceType,
    fileDiff,
    loadingFileDiff,
    fileDiffError,
    selectedTrack,
  ]);

  const getDiff = (obj1: any, obj2: any): DiffItem[] => {
    const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
    const diffs: DiffItem[] = [];

    keys.forEach((key) => {
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];

      if (val1 === undefined && val2 !== undefined) {
        diffs.push({ key, type: 'added', newValue: val2 });
      } else if (val1 !== undefined && val2 === undefined) {
        diffs.push({ key, type: 'removed', oldValue: val1 });
      } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        diffs.push({ key, type: 'changed', oldValue: val1, newValue: val2 });
      }
    });

    return diffs.sort((a, b) => a.key.localeCompare(b.key));
  };

  const renderDiffValue = (value: any) => {
    if (value === undefined || value === null) {
      return (
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          None
        </Typography>
      );
    }
    if (typeof value === 'object') {
      return <pre style={{ margin: 0, fontSize: '0.75rem' }}>{JSON.stringify(value, null, 2)}</pre>;
    }
    return String(value);
  };

  const renderDiffSection = (title: string, diffs: DiffItem[]) => {
    if (diffs.length === 0) {
      return (
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No differences found.
          </Typography>
        </Box>
      );
    }

    return (
      <Box mb={3}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Paper variant="outlined">
          {diffs.map((diff, index) => (
            <Box key={diff.key}>
              {index > 0 && <Divider />}
              <Box
                p={2}
                sx={{
                  bgcolor:
                    diff.type === 'added'
                      ? 'success.lighter'
                      : diff.type === 'removed'
                        ? 'error.lighter'
                        : diff.type === 'changed'
                          ? 'warning.lighter'
                          : 'transparent',
                  backgroundColor:
                    diff.type === 'added'
                      ? 'rgba(76, 175, 80, 0.08)'
                      : diff.type === 'removed'
                        ? 'rgba(244, 67, 54, 0.08)'
                        : diff.type === 'changed'
                          ? 'rgba(255, 152, 0, 0.08)'
                          : 'transparent',
                }}
              >
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
                  >
                    {diff.key}
                  </Typography>
                </Box>

                <Grid container spacing={2} alignItems="center">
                  <Grid size={5}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      gutterBottom
                    >
                      {selectedVersion}
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1,
                        bgcolor: 'background.default',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        minHeight: '32px',
                      }}
                    >
                      {renderDiffValue(diff.oldValue)}
                    </Paper>
                  </Grid>

                  <Grid size={2} sx={{ display: 'flex', justifyContent: 'center' }}>
                    <ArrowForwardIcon color="action" />
                  </Grid>

                  <Grid size={5}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                      gutterBottom
                    >
                      {currentModule.version} (Current)
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1,
                        bgcolor: 'background.default',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        minHeight: '32px',
                      }}
                    >
                      {renderDiffValue(diff.newValue)}
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          ))}
        </Paper>
      </Box>
    );
  };

  if (!currentModule) return null;

  const getProviderMap = (providers: any[]) => {
    if (!Array.isArray(providers)) return {};
    return Object.fromEntries(providers.map((p) => [p.source, p.version]));
  };

  const variableDiffs = comparisonData
    ? getDiff(
        comparisonData.manifest?.spec?.variables || {},
        currentModule.manifest?.spec?.variables || {},
      )
    : [];

  const outputDiffs = comparisonData
    ? getDiff(
        comparisonData.manifest?.spec?.outputs || {},
        currentModule.manifest?.spec?.outputs || {},
      )
    : [];

  const providerDiffs = comparisonData
    ? getDiff(
        getProviderMap(comparisonData.tf_lock_providers),
        getProviderMap(currentModule.tf_lock_providers),
      )
    : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Compare Versions: {currentModule.module || currentModule.module_name}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {loadingVersions ? (
          <Progress />
        ) : error ? (
          <ResponseErrorPanel error={error} />
        ) : (
          <Box>
            <Box mb={3} display="flex" alignItems="center" gap={2}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Track</InputLabel>
                <Select
                  value={selectedTrack}
                  label="Track"
                  onChange={(e) => setSelectedTrack(e.target.value)}
                >
                  {['stable', 'beta', 'alpha', 'dev'].map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Version</InputLabel>
                <Select
                  value={selectedVersion}
                  label="Version"
                  onChange={(e) => setSelectedVersion(e.target.value)}
                >
                  {versions.map((v) => (
                    <MenuItem key={v.version} value={v.version}>
                      {v.version}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <ArrowForwardIcon color="action" />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {currentModule.version} (Current)
              </Typography>
            </Box>

            {loadingComparison ? (
              <Progress />
            ) : comparisonData ? (
              <>
                {renderDiffSection('Variables', variableDiffs)}
                {renderDiffSection('Outputs', outputDiffs)}
                {renderDiffSection('Provider Lock', providerDiffs)}

                <Box mb={3}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="h6">File Changes</Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setShowFileChanges(!showFileChanges)}
                    >
                      {showFileChanges ? 'Hide' : 'Show'} File Changes
                    </Button>
                  </Box>

                  {showFileChanges && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      {loadingFileDiff ? (
                        <Progress />
                      ) : fileDiffError ? (
                        <Box
                          p={2}
                          bgcolor="error.light"
                          color="error.contrastText"
                          borderRadius={1}
                        >
                          <Typography variant="body2">
                            Error loading file changes: {fileDiffError}
                          </Typography>
                          <Button
                            size="small"
                            sx={{
                              mt: 1,
                              bgcolor: 'background.paper',
                              '&:hover': { bgcolor: 'grey.100' },
                            }}
                            onClick={() => {
                              setFileDiffError(null);
                              // This will trigger the effect again
                            }}
                          >
                            Retry
                          </Button>
                        </Box>
                      ) : fileDiff ? (
                        <ZipDiffBrowser fileDiff={fileDiff} height={500} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Unable to load file changes.
                        </Typography>
                      )}
                    </Paper>
                  )}
                </Box>
              </>
            ) : null}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
