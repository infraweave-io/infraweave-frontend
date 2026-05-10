import React, { useState } from 'react';

import Close from '@mui/icons-material/Close';
import { Drawer, Chip, Grid, Typography, Box, IconButton } from '@mui/material';
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
          <Typography style={{ color, fontWeight: 'bold', marginRight: 8 }}>{symbol}</Typography>
          <Typography component="span" style={{ fontWeight: 'bold' }}>
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
        added[prefix].forEach((item) => parts.push(formatPath(item.path, '++', 'limegreen')));
      }
      if (changes > 0) {
        changed[prefix].forEach((item) => parts.push(formatPath(item.path, '~~', 'blue')));
      }
      if (removals > 0) {
        removed[prefix].forEach((item) => parts.push(formatPath(item.path, '--', 'red')));
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
            <ReadChangesButton
              version_diff={versionDiff}
              label="See Changes"
              style={{ backgroundColor: 'royalblue', color: 'white' }}
            />
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
  style,
}: {
  version_diff?: VersionDiff;
  label: string;
  style: object;
}) => {
  const [isOpen, toggleDrawer] = useState(false);

  return (
    <>
      <Grid>
        <Chip label={label} style={style} onClick={() => toggleDrawer(true)} />
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

      <Box mt={2}>
        {Object.keys(added).map((prefix) => (
          <>
            <Typography key={`${prefix}-added`} variant="h6" style={{ color: 'green' }}>
              {capitalize(prefix)} Additions
            </Typography>
            {added[prefix].map((change, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  p: 1,
                  mb: 1,
                  bgcolor: '#FFF',
                  borderRadius: 1,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
              >
                <Typography sx={{ fontWeight: 'bold' }}>Path:</Typography>
                <Typography>{change.path}</Typography>
                <Typography sx={{ fontWeight: 'bold' }}>Value:</Typography>
                <Typography>{change.value}</Typography>
              </Box>
            ))}
          </>
        ))}

        {Object.keys(changed).map((prefix) => (
          <>
            <Typography key={`${prefix}-changed`} variant="h6" style={{ color: 'blue' }}>
              {capitalize(prefix)} Changes
            </Typography>
            {changed[prefix].map((change, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  p: 1,
                  mb: 1,
                  bgcolor: '#FFF',
                  borderRadius: 1,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
              >
                <Typography sx={{ fontWeight: 'bold' }}>Path:</Typography>
                <Typography>{change.path}</Typography>
                <Typography sx={{ fontWeight: 'bold' }}>Old Value:</Typography>
                <Typography>{change.old_value}</Typography>
                <Typography sx={{ fontWeight: 'bold' }}>New Value:</Typography>
                <Typography>{change.new_value}</Typography>
              </Box>
            ))}
          </>
        ))}

        {Object.keys(removed).map((prefix) => (
          <>
            <Typography key={`${prefix}-removed`} variant="h6" style={{ color: 'red' }}>
              {capitalize(prefix)} Removals
            </Typography>
            {removed[prefix].map((change, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  p: 1,
                  mb: 1,
                  bgcolor: '#FFF',
                  borderRadius: 1,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                }}
              >
                <Typography sx={{ fontWeight: 'bold' }}>Path:</Typography>
                <Typography>{change.path}</Typography>
                <Typography sx={{ fontWeight: 'bold' }}>Value:</Typography>
                <Typography>{change.value}</Typography>
              </Box>
            ))}
          </>
        ))}
      </Box>

      <Button variant="contained" onClick={() => toggleDrawer(false)} fullWidth>
        Close
      </Button>
    </Box>
  );
};
