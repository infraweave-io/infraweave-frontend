import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { Project, RepositoryData } from '../../types/Project';

interface SelectedProjectContextProps {
  projects: Project[];
  /** True only when there is no cached project list to fall back on. */
  loadingProjects: boolean;
  /** Set when the last projects request failed; `projects` may still be populated from cache. */
  projectsError?: Error;
  fetchProjects: () => Promise<void>;
  selectedProjectName: string | null;
  selectedRepositoryData: RepositoryData | null;
  selectedRegion: string | null;
  getSelectedProject: () => Project | null;
  setProjectSelection: (projectName: string) => void;
  setRepositoryDataSelection: (repositoryData: RepositoryData) => void;
  setRegionSelection: (regionName: string) => void;
  availableRegions: string[];
  availableRepositoryData: RepositoryData[];
}

const SelectedProjectContext = createContext<SelectedProjectContextProps | undefined>(undefined);

export const SelectedProjectProvider = ({ children }: { children: ReactNode }) => {
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(() => {
    const savedName = localStorage.getItem('selectedProjectName');
    return savedName ? JSON.parse(savedName) : null;
  });

  const [selectedRegion, setSelectedRegion] = useState<string | null>(() => {
    const savedRegion = localStorage.getItem('selectedRegion');
    return savedRegion ? JSON.parse(savedRegion) : null;
  });

  // Seeded from cache so the project picker is populated on open, then refreshed
  // in the background so a newly created project appears without a reload.
  const {
    projects,
    loading: loadingProjects,
    error: projectsError,
    refresh: fetchProjects,
  } = useProjects();
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [selectedRepositoryData, setSelectedRepositoryData] = useState<RepositoryData | null>(
    () => {
      const savedRepositoryData = localStorage.getItem('selectedRepositoryData');
      return savedRepositoryData ? JSON.parse(savedRepositoryData) : null;
    },
  );
  const [availableRepositoryData, setAvailableRepositoryData] = useState<RepositoryData[]>([]);

  useEffect(() => {
    localStorage.setItem('selectedProjectName', JSON.stringify(selectedProjectName));
  }, [selectedProjectName]);

  // Auto-select the only project when there is exactly one to choose from.
  useEffect(() => {
    if (loadingProjects) return;
    if (!selectedProjectName && projects.length === 1) {
      setSelectedProjectName(projects[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, loadingProjects]);

  useEffect(() => {
    if (loadingProjects) return;

    const newAvailableRegions = projects
      .filter((project) => project.name === selectedProjectName)
      .flatMap((project) => project.regions)
      .filter((value, index, self) => self.indexOf(value) === index);
    setAvailableRegions(newAvailableRegions);

    const newAvailableRepositoryData = projects
      .filter((project) => project.name === selectedProjectName)
      .flatMap((project) => project.repositories)
      .filter((value) => value.type === 'webhook');
    setAvailableRepositoryData(newAvailableRepositoryData);

    if (selectedRegion && !newAvailableRegions.includes(selectedRegion)) {
      setSelectedRegion(null);
    }

    if (selectedRepositoryData && !newAvailableRepositoryData.includes(selectedRepositoryData)) {
      setSelectedRepositoryData(null);
    }

    // When only one option is available, select it automatically so the user doesn't
    // have to pick from a list of one.
    if (!selectedRegion && newAvailableRegions.length === 1) {
      setSelectedRegion(newAvailableRegions[0]);
    }
    if (!selectedRepositoryData && newAvailableRepositoryData.length === 1) {
      setSelectedRepositoryData(newAvailableRepositoryData[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectName, projects, loadingProjects]);

  useEffect(() => {
    localStorage.setItem('selectedRegion', JSON.stringify(selectedRegion));
  }, [selectedRegion]);

  useEffect(() => {
    localStorage.setItem('selectedRepositoryData', JSON.stringify(selectedRepositoryData));
  }, [selectedRepositoryData]);

  const getSelectedProject = () =>
    projects.find((project) => project.name === selectedProjectName) || null;

  const setProjectSelection = (projectName: string) => {
    setSelectedProjectName(projectName === selectedProjectName ? null : projectName);
  };

  const setRegionSelection = (regionName: string) => {
    if (availableRegions.includes(regionName)) {
      setSelectedRegion(regionName === selectedRegion ? null : regionName);
    }
  };

  const setRepositoryDataSelection = (repositoryData: RepositoryData) => {
    if (availableRepositoryData.includes(repositoryData)) {
      setSelectedRepositoryData(
        repositoryData.repository_path === selectedRepositoryData?.repository_path
          ? null
          : repositoryData,
      );
    }
  };

  return (
    <SelectedProjectContext.Provider
      value={{
        selectedProjectName,
        selectedRegion,
        selectedRepositoryData,
        projects,
        loadingProjects,
        projectsError,
        setProjectSelection,
        setRegionSelection,
        setRepositoryDataSelection,
        getSelectedProject,
        fetchProjects,
        availableRegions,
        availableRepositoryData,
      }}
    >
      {children}
    </SelectedProjectContext.Provider>
  );
};

export const useSelectedProject = () => {
  const context = useContext(SelectedProjectContext);
  if (!context) {
    throw new Error('useSelectedProject must be used within a SelectedProjectProvider');
  }
  return context;
};
