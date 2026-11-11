import React from 'react';
import { useSelectedProjects } from './SelectedProjectsContext';
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
  emptyContent?: React.ReactNode;
};

export const DenseTable = ({ projects, emptyContent }: DenseTableProps) => {
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
      emptyContent={emptyContent}
    />
  );
};

export const Projects = () => {
  const { selectedProviders } = useSelectedProviders();
  // Shares the context's cached list — seeded from storage so the table is drawn
  // immediately, and refetched only once that copy has gone stale. Fetching here
  // as well would have meant two requests for the same list on this tab.
  //
  // This replaces a 60s polling interval: the list is now refreshed when the tab
  // is opened or returned to with a stale cache, rather than on a timer while it
  // sits unwatched.
  const { projects, loadingProjects: loading, projectsError: error } = useSelectedProjects();
  const cloudSelected = selectedProviders.length > 0;

  if (loading && cloudSelected) {
    return <Progress />;
  } else if (error && projects.length === 0 && cloudSelected) {
    // Only surfaced when there is nothing to show: a failed background refresh
    // over a warm cache must not replace a working table with an error. Gated on
    // the cloud filter like the spinner above it, so with no cloud selected the
    // table keeps saying so instead of reporting a fetch the user never saw.
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <DenseTable
      projects={cloudSelected ? projects : []}
      emptyContent={
        cloudSelected
          ? 'No projects found for the selected cloud.'
          : 'Select a cloud to browse projects.'
      }
    />
  );
};
