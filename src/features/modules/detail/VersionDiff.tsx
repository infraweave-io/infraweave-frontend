import React, { useState } from 'react';

import Close from '@mui/icons-material/Close';
import { Drawer, Chip, Grid, Typography, Box, IconButton } from '@mui/material';
import { MONO_FONT } from '../../../contexts/ThemeContext';
import { VersionDiff } from '../../../types/Module';
import { Button, capitalize } from '@mui/material';

// Function to categorize changes based on path prefixes dynamically
const categorizeChangesByPrefix = (
  changes: { path: string; value?: string; old_value?: string; new_value?: string }[] | undefined,
) => {
  const categorized: {
    [prefix: string]: { path: string; value?: string; old_value?: string; new_value?: string }[];
  } = {};

  changes?.forEach((change) => {
    // Extract the prefix (e.g., /variable/ from /variable/somepath)
    const prefix = change.path.split('/')[1]; // Grabbing the first segment after "/"

    if (prefix) {
      if (!categorized[prefix]) {
        categorized[prefix] = [];
      }
      categorized[prefix].push(change);
    }
  });

  return categorized;
};

export const ChangesTags: React.FC<{ versionDiff: VersionDiff }> = ({ versionDiff }) => {
  const added = categorizeChangesByPrefix(versionDiff.added);
  const changed = categorizeChangesByPrefix(versionDiff.changed);
  const removed = categorizeChangesByPrefix(versionDiff.removed);

  const generateSummary = () => {
    const summaryLines: React.JSX.Element[] = [];

    // Combine all unique prefixes
    const allPrefixes = new Set([
      ...Object.keys(added),
      ...Object.keys(changed),
      ...Object.keys(removed),
    ]);

    // Function to format each line with the change type symbol and path
    const formatPath = (path: string, symbol: string, color: string) => {
      const [prefix, ...rest] = path.split('/').filter(Boolean); // Get the first segment as prefix and rest as the path
      return (
        <Box key={path} component="div" display="flex" alignItems="center" mb={1}>
          {/* sx, not style: the colour is a palette token that has to resolve
              through the theme so it flips with dark mode. */}
          <Typography variant="body2" sx={{ color, fontWeight: 700, mr: 1, fontFamily: MONO_FONT }}>
            {symbol}
          </Typography>
          <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
            {prefix}
          </Typography>
          <Box ml={1} />
          <Typography component="span">{rest.length > 0 ? ` (${rest.join('/')})` : ''}</Typography>
        </Box>
      );
    };

    allPrefixes.forEach((prefix) => {
      const additions = added[prefix]?.length || 0;
      const changes = changed[prefix]?.length || 0;
      const removals = removed[prefix]?.length || 0;

      const parts: React.JSX.Element[] = [];

      // Collect all additions, changes, removals under this prefix with respective symbols and colors
      if (additions > 0) {
        added[prefix].forEach((item) => parts.push(formatPath(item.path, '++', 'success.main')));
      }
      if (changes > 0) {
        changed[prefix].forEach((item) => parts.push(formatPath(item.path, '~~', 'info.main')));
      }
      if (removals > 0) {
        removed[prefix].forEach((item) => parts.push(formatPath(item.path, '--', 'error.main')));
      }

      if (parts.length > 0) {
        summaryLines.push(
          <Box key={prefix} mb={0}>
            {parts}
          </Box>,
        );
      }
    });

    return summaryLines;
  };

  // Function to capitalize the first letter of a string
  // const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  const summary = generateSummary();

  return (
    <>
      <Grid container spacing={1} alignItems="center" justifyContent="space-between">
        <Grid>
          {summary && (
            <Box mt={2}>
              <Typography variant="body2" style={{ whiteSpace: 'pre-line' }}>
                {summary}
              </Typography>
            </Box>
          )}
        </Grid>

        {(Object.keys(added).length > 0 ||
          Object.keys(changed).length > 0 ||
          Object.keys(removed).length > 0) && (
          <Grid>
            <ReadChangesButton version_diff={versionDiff} label="See changes" />
          </Grid>
        )}
      </Grid>
    </>
  );
};

// Button component to open the drawer
const ReadChangesButton = ({
  version_diff,
  label,
}: {
  version_diff?: VersionDiff;
  label: string;
}) => {
  const [isOpen, toggleDrawer] = useState(false);

  return (
    <>
      <Grid>
        <Chip label={label} variant="outlined" onClick={() => toggleDrawer(true)} />
      </Grid>
      <Drawer
        PaperProps={{ sx: { width: '70%', justifyContent: 'space-between', p: 2.5 } }}
        anchor="right"
        open={isOpen}
        onClose={() => toggleDrawer(false)}
      >
        <DrawerContent toggleDrawer={toggleDrawer} version_diff={version_diff} />
      </Drawer>
    </>
  );
};

// Drawer content component that displays detailed changes
const DrawerContent = ({
  toggleDrawer,
  version_diff,
}: {
  toggleDrawer: (isOpen: boolean) => void;
  version_diff?: VersionDiff;
}) => {
  const added = categorizeChangesByPrefix(version_diff?.added);
  const changed = categorizeChangesByPrefix(version_diff?.changed);
  const removed = categorizeChangesByPrefix(version_diff?.removed);

  return (
    <Box sx={{ height: '80%', p: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h5">Compared to version {version_diff?.previous_version}</Typography>

        <IconButton
          key="dismiss"
          title="Close the drawer"
          onClick={() => toggleDrawer(false)}
          color="inherit"
        >
          <Close sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* The three sections were near-identical copies differing only in colour
          and field list, each with a hardcoded white card that vanished in dark
          mode and an unkeyed fragment. One driver table covers all three. */}
      <Box mt={2}>
        {(
          [
            { id: 'added', noun: 'Additions', groups: added, tone: 'success.main' },
            { id: 'changed', noun: 'Changes', groups: changed, tone: 'info.main' },
            { id: 'removed', noun: 'Removals', groups: removed, tone: 'error.main' },
          ] as const
        ).map(({ id, noun, groups, tone }) =>
          Object.keys(groups).map((prefix) => (
            <Box key={`${prefix}-${id}`} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ color: tone, mb: 1 }}>
                {capitalize(prefix)} {noun}
              </Typography>
              {groups[prefix].map((change, index) => (
                <Box
                  key={index}
                  sx={{
                    p: 1.25,
                    mb: 1,
                    bgcolor: 'background.default',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: '3px solid',
                    borderLeftColor: tone,
                    borderRadius: 1,
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    columnGap: 1.5,
                    rowGap: 0.25,
                  }}
                >
                  {(
                    [
                      ['Path', change.path],
                      ...(id === 'changed'
                        ? ([
                            ['Old value', change.old_value],
                            ['New value', change.new_value],
                          ] as [string, string | undefined][])
                        : ([['Value', change.value]] as [string, string | undefined][])),
                    ] as [string, string | undefined][]
                  ).map(([label, value]) => (
                    <React.Fragment key={label}>
                      <Typography variant="body2" color="text.secondary">
                        {label}
                      </Typography>
                      <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                        {value}
                      </Typography>
                    </React.Fragment>
                  ))}
                </Box>
              ))}
            </Box>
          )),
        )}
      </Box>

      <Button variant="contained" onClick={() => toggleDrawer(false)} fullWidth>
        Close
      </Button>
    </Box>
  );
};
