import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useProjects } from '../../../hooks/useProjects';
import { Project } from '../../../types/Deployment';

// Context to hold selected project names, regions, and project metadata
interface SelectedProjectsContextProps {
  selectedProjectNames: string[];
  selectedRegions: string[];
  projects: Project[];
  /** True only when there is no cached project list to fall back on. */
  loadingProjects: boolean;
  /** Set when the last projects request failed; `projects` may still be populated from cache. */
  projectsError?: Error;
  toggleProjectSelection: (projectName: string) => void;
  toggleRegionSelection: (regionName: string) => void;
  fetchProjects: () => Promise<void>; // Allows refetching if needed
  availableRegions: string[]; // Regions of the selected projects, or of all projects when none are
}

const SelectedProjectsContext = createContext<SelectedProjectsContextProps | undefined>(undefined);

export const SelectedProjectsProvider = ({ children }: { children: ReactNode }) => {
  const [selectedProjectNames, setSelectedProjectNames] = useState<string[]>(() => {
    // Load from localStorage on initial load
    const savedNames = localStorage.getItem('selectedProjectNames');
    return savedNames ? JSON.parse(savedNames) : [];
  });

  const [selectedRegions, setSelectedRegions] = useState<string[]>(() => {
    // Load from localStorage on initial load
    const savedRegions = localStorage.getItem('selectedRegions');
    return savedRegions ? JSON.parse(savedRegions) : [];
  });

  // Seeded from cache so the filter panel draws immediately, then refreshed in
  // the background on every mount so added/removed projects show up on their own.
  const {
    projects,
    loading: loadingProjects,
    error: projectsError,
    refresh: fetchProjects,
  } = useProjects();

  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  // Update localStorage whenever selectedProjectNames changes
  useEffect(() => {
    localStorage.setItem('selectedProjectNames', JSON.stringify(selectedProjectNames));
  }, [selectedProjectNames]);

  // Update availableRegions whenever selectedProjectNames or projects change
  useEffect(() => {
    if (loadingProjects) {
      // Don't run this effect until projects have been loaded
      return;
    }

    // Compute availableRegions based on selectedProjectNames. With nothing
    // selected, every project's regions are offered: the region filter sits
    // above the projects, so it has to be pickable before any project is.
    const safeProjects = Array.isArray(projects) ? projects : [];
    const regionSource =
      selectedProjectNames.length > 0
        ? safeProjects.filter((project) => selectedProjectNames.includes(project.name))
        : safeProjects;
    const newAvailableRegions = regionSource
      .flatMap((project) => project.regions ?? [])
      .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

    setAvailableRegions(newAvailableRegions);

    // Remove selectedRegions that are no longer available
    setSelectedRegions((prevSelectedRegions) =>
      prevSelectedRegions.filter((region) => newAvailableRegions.includes(region)),
    );
  }, [selectedProjectNames, projects, loadingProjects]);

  // Update localStorage whenever selectedRegions changes
  useEffect(() => {
    localStorage.setItem('selectedRegions', JSON.stringify(selectedRegions));
  }, [selectedRegions]);

  const toggleProjectSelection = (projectName: string) => {
    setSelectedProjectNames((prevNames) => {
      const newSelectedNames = prevNames.includes(projectName)
        ? prevNames.filter((name) => name !== projectName)
        : [...prevNames, projectName];

      return newSelectedNames;
    });
  };

  const toggleRegionSelection = (regionName: string) => {
    setSelectedRegions((prevRegions) => {
      if (!availableRegions.includes(regionName)) {
        // Region is not available, do nothing
        return prevRegions;
      }
      return prevRegions.includes(regionName)
        ? prevRegions.filter((name) => name !== regionName)
        : [...prevRegions, regionName];
    });
  };

  return (
    <SelectedProjectsContext.Provider
      value={{
        selectedProjectNames,
        selectedRegions,
        projects,
        loadingProjects,
        projectsError,
        toggleProjectSelection,
        toggleRegionSelection,
        fetchProjects,
        availableRegions,
      }}
    >
      {children}
    </SelectedProjectsContext.Provider>
  );
};

// Hook to use selected projects context
export const useSelectedProjects = () => {
  const context = useContext(SelectedProjectsContext);
  if (!context) {
    throw new Error('useSelectedProjects must be used within a SelectedProjectsProvider');
  }
  return context;
};
