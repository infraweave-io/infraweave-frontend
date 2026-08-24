import React, { useEffect, useState } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import {
  Table,
  TableColumn,
  Progress,
  ResponseErrorPanel,
  MarkdownContent,
} from '../../../standalone/components/ComponentAdapter';
import { Project } from '../../../types/Project';
import { Box } from '@mui/material';
import { useSelectedProviders } from './SelectedProvidersContext';

type DenseTableProps = {
  projects: Project[];
};

export const DenseTable = ({ projects }: DenseTableProps) => {
  const columns: TableColumn[] = [
    { title: 'Project', field: 'project', width: '200px' },
    { title: 'Description', field: 'description' },
  ];

  const data = projects.map((policy) => {
    return {
      project: <Box sx={{ fontWeight: 600 }}>{policy.name}</Box>,
      // A nested raised card inside every table cell fought the table's own
      // borders; the description is just text in a cell.
      description: policy.description ? (
        <MarkdownContent content={policy.description} />
      ) : (
        <Box component="span" sx={{ color: 'text.disabled' }}>
          No description
        </Box>
      ),
    };
  });

  return (
    <Table
      options={{
        search: true,
        paging: false,
        draggable: true,
        columnResizable: true,
      }}
      columns={columns}
      data={data}
    />
  );
};

export const Projects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { selectedProviders } = useSelectedProviders();

  // Function to fetch projects for each selected provider in parallel
  const config = useConfig();
  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchPromises = selectedProviders.map((_provider) => {
        const url = config.getApiUrl('api/proxy/api/infraweave/api/v1/projects');
        return config.fetch(url).then((response) => {
          if (response.status >= 300 && response.status < 400) {
            throw new Error('Redirected to login or guest page');
          }
          return response.json();
        });
      });

      // Wait for all fetch requests to complete
      const results = await Promise.all(fetchPromises);

      // Merge all results into a single array
      const allProjects = results.flat();

      setProjects(allProjects);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch projects on initial render and whenever selectedProviders change
  useEffect(() => {
    if (selectedProviders.length > 0) {
      fetchProjects();
      const intervalId = setInterval(fetchProjects, 60000); // Refresh every 60 seconds
      return () => clearInterval(intervalId);
    }
    // Clear projects when no providers are selected
    setProjects([]);
    setLoading(false);
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProviders]);

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return <DenseTable projects={projects} />;
};
