import React from 'react';
import { useConfig } from '../../../hooks/useConfig';
import { Progress, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { useAsync } from '../../../hooks/useAsync';
import { Provider } from '../../../types/Provider';
import { Table, TableColumn, Link } from '../../../standalone/components/ComponentAdapter';
import { Box } from '@mui/material';

export const Providers = () => {
  const config = useConfig();
  const { value, loading, error } = useAsync(async (): Promise<Provider[]> => {
    const url = config.getApiUrl('api/proxy/api/infraweave/api/v1/providers');

    const response = await config.fetch(url);
    if (response.status >= 300 && response.status < 400) {
      throw new Error('Redirected to login or guest page');
    }
    if (!response.ok) throw new Error('Failed to fetch providers');

    const json = await response.json();
    return json.Items || json.items || json;
  }, []);

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  // Group providers by name and track
  const groupedProviders = (value || []).reduce(
    (acc: { [key: string]: { tracks: { [key: string]: string }; name?: string } }, provider) => {
      const providerName = provider.name;
      const track = provider.track || 'stable';

      if (!acc[providerName]) {
        acc[providerName] = { tracks: {}, name: providerName };
      }
      acc[providerName].tracks[track] = provider.version;
      return acc;
    },
    {},
  );

  const data = Object.entries(groupedProviders).map(([providerName, data]) => ({
    provider: providerName,
    name: data.name || providerName,
    stable_version: data.tracks.stable || '',
    beta_version: data.tracks.beta || '',
    alpha_version: data.tracks.alpha || '',
    dev_version: data.tracks.dev || '',
  }));

  const columns: TableColumn[] = [
    {
      title: 'Provider',
      field: 'name',
      render: (row: any) => (
        <Box
          component="span"
          sx={{
            cursor: 'pointer',
            '&:hover': {
              textDecoration: 'underline',
              color: 'primary.main',
            },
          }}
        >
          <Link
            to={`/infraweave/provider/stable/${encodeURIComponent(row.name)}/${encodeURIComponent(
              row.stable_version,
            )}`}
          >
            {row.name}
          </Link>
        </Box>
      ),
    },
    { title: 'Current Version', field: 'stable_version' },
  ];

  return (
    <Table
      title="Providers List"
      options={{ search: true, paging: true, pageSize: 10 }}
      columns={columns}
      data={data}
    />
  );
};
