import { Box, FormControlLabel, Checkbox, CircularProgress } from '@mui/material';

import React from 'react';
import { ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { FilterGroup } from '../../../shared/components/FilterGroup';
import { useSelectedProjects } from './SelectedProjectsContext';

const EnvFilterPanel = () => {
  // The panel used to fetch projects itself, duplicating the context's copy and
  // spinning on every mount. The context serves a cached list immediately and
  // refreshes it in the background, so an added or removed project appears on its
  // own without the list ever blanking out.
  const {
    projects,
    loadingProjects,
    projectsError,
    selectedProjectNames,
    availableRegions,
    selectedRegions,
    toggleProjectSelection,
    toggleRegionSelection,
  } = useSelectedProjects();

  // Check if a project is selected based on the context state
  const isProjectSelected = (projectName: string): boolean => {
    return selectedProjectNames.includes(projectName);
  };

  if (loadingProjects) {
    // Sized to sit inside the filter panel rather than taking over the column.
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={20} />
      </Box>
    );
  } else if (projectsError && projects.length === 0) {
    // Only surfaced when there is nothing to show: a failed background refresh
    // over a warm cache must not replace a working panel with an error.
    return <ResponseErrorPanel error={projectsError} />;
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
