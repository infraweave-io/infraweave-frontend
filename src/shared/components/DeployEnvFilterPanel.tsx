import React, { useState, useEffect } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { Box, Paper, Typography, TextField, Autocomplete } from '@mui/material';
import { Progress, ResponseErrorPanel } from '../../standalone/components/ComponentAdapter';
import { Project, RepositoryData } from '../../types/Project';
import { useSelectedProject } from './DeploySelectedContext';

const DeployEnvFilterPanel = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const {
    selectedProjectName,
    availableRepositoryData,
    selectedRepositoryData,
    setProjectSelection,
    setRepositoryDataSelection,
  } = useSelectedProject();

  const config = useConfig();
  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = config.getApiUrl('api/proxy/api/infraweave/api/v1/projects');
      const response = await config.fetch(url);

      if (response.status >= 300 && response.status < 400) {
        throw new Error('Redirected to login or guest page');
      }

      const json = await response.json();
      setProjects(json);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
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
