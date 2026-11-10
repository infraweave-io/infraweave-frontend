import React from 'react';
import { Progress, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { usePaginatedItems } from '../../../hooks/usePaginatedItems';
import { Provider } from '../../../types/Provider';
import { Table, TableColumn, Link } from '../../../standalone/components/ComponentAdapter';
import { LoadingMore } from '../../../shared/components/LoadingMore';
import { ListIncomplete } from '../../../shared/components/ListIncomplete';
import { useSelectedProviders } from '../../root/RootPage/SelectedProvidersContext';
import { Box } from '@mui/material';

export const Providers = () => {
  const { selectedProviders } = useSelectedProviders();
  // No cloud selected means nothing to show, so skip the request entirely
  // rather than fetching a list we are about to discard.
  const {
    items: value,
    loading,
    truncated,
    error,
  } = usePaginatedItems<Provider>(
    selectedProviders.length > 0 ? 'api/proxy/api/infraweave/api/v1/providers' : null,
    'providers',
  );

  // Only take over the whole view when there is nothing to show. A failure on a
  // later page keeps the pages already loaded, with the error beside them.
  if (error && value.length === 0) {
    return <ResponseErrorPanel error={error} />;
  } else if (loading && value.length === 0) {
    return <Progress />;
  }

  // Group providers by name and track
  const groupedProviders = value.reduce(
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

  const data = Object.entries(groupedProviders)
    .map(([providerName, data]) => ({
      provider: providerName,
      name: data.name || providerName,
      stable_version: data.tracks.stable || '',
      beta_version: data.tracks.beta || '',
      alpha_version: data.tracks.alpha || '',
      dev_version: data.tracks.dev || '',
    }))
    // Rows arrive page by page, so an explicit sort is what keeps already-visible
    // rows from being reshuffled as the rest of the list loads.
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const columns: TableColumn[] = [
    {
      title: 'Provider',
      field: 'name',
      render: (row: any) =>
        // The detail route is keyed by stable version. Mid-load a provider can be
        // seen on a non-stable track first, and linking to an empty version routes
        // nowhere — so stay unlinked until the stable record arrives.
        row.stable_version ? (
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
        ) : (
          <Box component="span">{row.name}</Box>
        ),
    },
    { title: 'Current Version', field: 'stable_version' },
  ];

  return (
    <>
      <Table
        options={{ search: true, paging: true, pageSize: 10 }}
        columns={columns}
        data={data}
        emptyContent={
          selectedProviders.length === 0
            ? 'Select a cloud to browse providers.'
            : 'No providers found.'
        }
      />
      {loading && <LoadingMore />}
      {truncated && <ListIncomplete label="providers" />}
      {error && <ResponseErrorPanel error={error} />}
    </>
  );
};
