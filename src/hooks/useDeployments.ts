import { useState, useEffect, useRef } from 'react';
import { Deployment, Project } from '../types/Deployment';
import { useConfig } from './useConfig';

interface UseDeploymentsResult {
  deployments: Deployment[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  isModalOpenRef: React.MutableRefObject<boolean>;
}

export const useDeployments = (
  projects: Project[],
  selectedProjectNames: string[],
  selectedRegions: string[],
  module?: string,
): UseDeploymentsResult => {
  const config = useConfig();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isModalOpenRef = useRef(false);

  const fetchDeployments = async () => {
    if (isModalOpenRef.current) return;

    try {
      if (deployments.length === 0) {
        setLoading(true);
      }
      setError(null);

      const selectedProjectIds = projects
        .filter((project) => selectedProjectNames.includes(project.name))
        .map((project) => project.project_id);

      const projectIdsString = selectedProjectIds.join(',');

      const fetchPromises =
        selectedProjectIds.length === 0
          ? []
          : selectedRegions.map((region) => {
              const url = module
                ? config.getApiUrl(
                    `api/proxy/api/infraweave/api/v1/deployments/module/${projectIdsString}/${region}/${module}`,
                  )
                : config.getApiUrl(
                    `api/proxy/api/infraweave/api/v1/deployments/${projectIdsString}/${region}`,
                  );

              return config
                .fetch(url)
                .then((response) => {
                  if (response.status === 401) return [];
                  if (response.status >= 300 && response.status < 400) {
                    throw new Error('Redirected to login or guest page');
                  }
                  if (!response.ok) throw new Error('Failed to fetch deployments');
                  return response.json().then((json) => json.Items || json.items || json);
                })
                .catch(() => []);
            });

      const results = await Promise.all(fetchPromises);
      const sorted = results.flat().sort((a, b) => (b.epoch || 0) - (a.epoch || 0));
      setDeployments(sorted);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projects.length > 0) {
      fetchDeployments();
      const intervalId = setInterval(fetchDeployments, 60000);
      return () => clearInterval(intervalId);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, selectedProjectNames, selectedRegions, module]);

  return { deployments, loading, error, refetch: fetchDeployments, isModalOpenRef };
};
