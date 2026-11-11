import React from 'react';
import { Box, Paper, Typography, TextField, Autocomplete } from '@mui/material';
import { Progress, ResponseErrorPanel } from '../../standalone/components/ComponentAdapter';
import { RepositoryData } from '../../types/Project';
import { useSelectedProject } from './DeploySelectedContext';

const DeployEnvFilterPanel = () => {
  // The panel used to fetch projects itself, duplicating the context's copy. The
  // context serves a cached list immediately and refreshes it in the background.
  const {
    projects,
    loadingProjects,
    projectsError,
    selectedProjectName,
    availableRepositoryData,
    selectedRepositoryData,
    setProjectSelection,
    setRepositoryDataSelection,
  } = useSelectedProject();

  if (loadingProjects) {
    return <Progress />;
  } else if (projectsError && projects.length === 0) {
    // Only surfaced when there is nothing to show: a failed background refresh
    // over a warm cache must not replace a working picker with an error.
    return <ResponseErrorPanel error={projectsError} />;
  }

  return (
    <>
      <Paper elevation={1} style={{ padding: 10 }}>
        <Typography variant="h6">Select Project:</Typography>
        <br />
        <Autocomplete
          value={selectedProjectName}
          options={projects.map((project) => project.name)}
          onChange={(_event, newValue) => {
            if (newValue != null) setProjectSelection(newValue);
          }}
          renderInput={(params) => <TextField {...params} label="Projects" variant="outlined" />}
        />

        <Box mt={2} />

        <Typography variant="h6">Select Repository:</Typography>
        <br />
        <Autocomplete<RepositoryData | null>
          value={selectedRepositoryData}
          options={availableRepositoryData}
          onChange={(_event, newValue) => {
            if (newValue != null && typeof newValue !== 'string')
              setRepositoryDataSelection(newValue);
          }}
          getOptionLabel={(option) => option?.repository_path || 'No repository selected'}
          renderInput={(params) => <TextField {...params} label="Repository" variant="outlined" />}
        />
      </Paper>
    </>
  );
};

export default DeployEnvFilterPanel;
