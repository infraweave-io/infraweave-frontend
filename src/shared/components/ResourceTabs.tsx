import React from 'react';
import { Typography, Grid, Box, Link, ToggleButtonGroup } from '@mui/material';
import {
  InfoCard,
  StructuredMetadataTable,
  MarkdownContent,
  Content,
} from '../../standalone/components/ComponentAdapter';
import { ResourceInputs, CustomToggleButton } from './ResourceInputs';
import { ResourceOutputs } from './ResourceOutputs';
import { Module } from '../../types/Module';
import { Deployments } from '../../features/deployments';
import { SelectedProjectsProvider } from '../../features/root/RootPage/SelectedProjectsContext';
import EnvFilterPanel from '../../features/root/RootPage/EnvFilterPanel';

export interface InformationTabProps {
  data?: Module;
  view: string;
  onViewChange: (event: React.MouseEvent<HTMLElement>, newView: string | null) => void;
  resourceType: 'module' | 'stack';
}

export const InformationTab: React.FC<InformationTabProps> = ({
  data,
  view,
  onViewChange,
  resourceType,
}) => {
  const isStack = resourceType === 'stack';
  const resourceLabel = isStack ? 'Stack' : 'Module';

  return (
    <Content>
      <Grid container spacing={3}>
        <Grid size={12}>
          <InfoCard title="Description">
            <MarkdownContent content={data?.description || '<No description>'} />
          </InfoCard>
        </Grid>
        <Grid size={12}>
          <InfoCard title="Information">
            <StructuredMetadataTable
              metadata={{
                [resourceLabel]: data?.module,
                [`${resourceLabel} Version`]: data?.version,
                Reference: <Link href={data?.reference}>{data?.reference}</Link>,
                Created: data?.timestamp,
                'Provider requirements': (
                  <>
                    {data?.tf_required_providers?.map((provider) => (
                      <div
                        key={provider.source}
                        style={{ lineHeight: '1.6em', marginBottom: '0.1em' }}
                      >
                        {provider.source}
                        {': '}
                        <strong>
                          {provider.version.startsWith('~>')
                            ? `"${provider.version}"`
                            : provider.version}
                        </strong>
                      </div>
                    ))}
                  </>
                ),
                Lockfile: (
                  <>
                    {data?.tf_lock_providers?.map((provider) => (
                      <div
                        key={provider.source}
                        style={{ lineHeight: '1.6em', marginBottom: '0.1em' }}
                      >
                        {provider.source}
                        {': '}
                        <strong>{provider.version}</strong>
                      </div>
                    ))}
                  </>
                ),
              }}
            />
          </InfoCard>
        </Grid>
        <Grid size={12}>
          <Box display="flex" justifyContent="center" mb={2} mt={2}>
            <ToggleButtonGroup
              value={view}
              exclusive
              onChange={onViewChange}
              aria-label="View toggle"
              style={{ marginLeft: 'auto', marginRight: 'auto' }}
            >
              <CustomToggleButton value="manifest" aria-label="Manifest">
                Manifest
              </CustomToggleButton>
              <CustomToggleButton value="python" aria-label="Python">
                Python
              </CustomToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ResourceInputs inputs={data?.tf_variables} view={view} resourceType={resourceType} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ResourceOutputs outputs={data?.tf_outputs} view={view} resourceType={resourceType} />
        </Grid>
      </Grid>
      <Box sx={{ height: 32 }} />
    </Content>
  );
};

export interface UsageTabProps {
  data?: Module;
  resourceType: 'module' | 'stack';
}

export const UsageTab: React.FC<UsageTabProps> = ({ data, resourceType }) => {
  const isStack = resourceType === 'stack';

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 3 }}>
        <SelectedProjectsProvider>
          <EnvFilterPanel />
        </SelectedProjectsProvider>
      </Grid>
      <Grid size={{ xs: 12, md: 9 }}>
        <InfoCard title={`${isStack ? 'Stack' : 'Module'} Deployments`}>
          <Typography variant="body1">
            View all deployments of this {isStack ? 'stack' : 'module'}.
          </Typography>
        </InfoCard>
        <Box p={1} />
        <SelectedProjectsProvider>
          <Deployments module={data?.module} />
        </SelectedProjectsProvider>
      </Grid>
    </Grid>
  );
};
