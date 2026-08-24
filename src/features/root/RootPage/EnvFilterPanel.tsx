import { useState, useEffect } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import { Box, FormControlLabel, Checkbox, CircularProgress } from '@mui/material';

import React from 'react';
import { ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { FilterGroup } from '../../../shared/components/FilterGroup';
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
    // Sized to sit inside the filter panel rather than taking over the column.
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={20} />
      </Box>
    );
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <>
      <FilterGroup label="Projects">
        {projects.map((project) => (
          <FormControlLabel
            key={project.project_id}
            control={
              <Checkbox
                size="small"
                checked={isProjectSelected(project.name)}
                onChange={() => toggleProjectSelection(project.name)}
                name={project.name}
                color="primary"
              />
            }
            label={project.name}
          />
        ))}
      </FilterGroup>
      <FilterGroup label="Regions">
        {availableRegions.map((region) => (
          <FormControlLabel
            key={region}
            control={
              <Checkbox
                size="small"
                checked={selectedRegions.includes(region)}
                onChange={() => toggleRegionSelection(region)}
                name={region}
                color="primary"
              />
            }
            label={region}
          />
        ))}
      </FilterGroup>
    </>
  );
};

export default EnvFilterPanel;
