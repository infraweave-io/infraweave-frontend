import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { Project, RepositoryData } from '../../types/Project';

interface SelectedProjectContextProps {
  projects: Project[];
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

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectName, projects, loadingProjects]);

  useEffect(() => {
    localStorage.setItem('selectedRegion', JSON.stringify(selectedRegion));
  }, [selectedRegion]);

  useEffect(() => {
    localStorage.setItem('selectedRepositoryData', JSON.stringify(selectedRepositoryData));
  }, [selectedRepositoryData]);

  const config = useConfig();
  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const url = config.getApiUrl('api/proxy/api/infraweave/api/v1/projects');
      const response = await config.fetch(url);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const json = await response.json();
      setProjects(json);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
