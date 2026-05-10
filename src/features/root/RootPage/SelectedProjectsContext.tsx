import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import { Project } from '../../../types/Deployment';

// Context to hold selected project names, regions, and project metadata
interface SelectedProjectsContextProps {
  selectedProjectNames: string[];
  selectedRegions: string[];
  projects: Project[];
  toggleProjectSelection: (projectName: string) => void;
  toggleRegionSelection: (regionName: string) => void;
  fetchProjects: () => Promise<void>; // Allows refetching if needed
  availableRegions: string[]; // Regions available based on selected projects
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

  const [projects, setProjects] = useState<Project[]>(() => {
    // Load cached projects from localStorage on initial load
    const cachedProjects = localStorage.getItem('cachedProjects');
    return cachedProjects ? JSON.parse(cachedProjects) : [];
  });
  const [loadingProjects, setLoadingProjects] = useState(false);

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

    // Compute availableRegions based on selectedProjectNames
    const safeProjects = Array.isArray(projects) ? projects : [];
    const newAvailableRegions = safeProjects
      .filter((project) => selectedProjectNames.includes(project.name))
      .flatMap((project) => project.regions)
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

  // Function to fetch project metadata (for mapping names to project IDs)
  const config = useConfig();
  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);

      const url = config.getApiUrl('api/proxy/api/infraweave/api/v1/projects');
      const response = await config.fetch(url);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const json = await response.json();

      let projectsList: Project[] = [];
      if (Array.isArray(json)) {
        projectsList = json;
      } else if (json && Array.isArray(json.items)) {
        projectsList = json.items;
      } else if (json && Array.isArray(json.Items)) {
        projectsList = json.Items;
      } else {
        console.error('Unexpected projects response format:', json);
        projectsList = [];
      }

      setProjects(projectsList);
      // Cache the projects in localStorage
      localStorage.setItem('cachedProjects', JSON.stringify(projectsList));
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Fetch projects on initial load ONLY if cache is empty
  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects();
    } else {
      // Projects loaded from cache, mark as not loading
      setLoadingProjects(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount

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
