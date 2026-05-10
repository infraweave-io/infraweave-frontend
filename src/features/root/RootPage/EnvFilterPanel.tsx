import { useState, useEffect } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import { Box, Paper, Typography, FormControlLabel, Checkbox } from '@mui/material';

import React from 'react';
import { Progress, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { Project } from '../../../types/Deployment';
import { useSelectedProjects } from './SelectedProjectsContext';

const EnvFilterPanel = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const {
    selectedProjectNames,
    availableRegions,
    selectedRegions,
    toggleProjectSelection,
    toggleRegionSelection,
  } = useSelectedProjects();

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

  // Fetch projects on component mount
  useEffect(() => {
    fetchProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if a project is selected based on the context state
  const isProjectSelected = (projectName: string): boolean => {
    return selectedProjectNames.includes(projectName);
  };

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <>
      <Paper elevation={1}>
        <Box p={2}>
          <Typography variant="h6">Projects:</Typography>
          {projects.map((project) => (
            <FormControlLabel
              key={project.project_id}
              control={
                <Checkbox
                  checked={isProjectSelected(project.name)}
                  onChange={() => toggleProjectSelection(project.name)}
                  name={project.name}
                  color="primary"
                />
              }
              label={project.name}
            />
          ))}
        </Box>
      </Paper>
      <Box mt={2} />
      <Paper elevation={1}>
        <Box p={2}>
          <Typography variant="h6">Regions:</Typography>
          {availableRegions.map((region) => (
            <FormControlLabel
              key={region}
              control={
                <Checkbox
                  checked={selectedRegions.includes(region)}
                  onChange={() => toggleRegionSelection(region)}
                  name={region}
                  color="primary"
                />
              }
              label={region}
            />
          ))}
        </Box>
      </Paper>
    </>
  );
};

export default EnvFilterPanel;
