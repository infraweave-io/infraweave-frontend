import React, { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useIsStandalone } from '../../../contexts/ConfigContext';
import { useDeployment } from '../../../hooks/useDeployment';
import { Grid, Button } from '@mui/material';
import {
  Progress,
  ResponseErrorPanel,
  Header,
  Page,
  Content,
  HeaderLabel,
  HeaderTabs,
} from '../../../standalone/components/ComponentAdapter';
import { useParams, useNavigate } from 'react-router-dom';
import { AllChangeRecords } from './Events';
import { DeploymentOverview } from './DeploymentOverview';

const tabs = [
  { label: 'Overview', id: 'overview' },
  { label: 'Events & Logs', id: 'events' },
];

interface DeletedTitleProps {
  text: string;
  isDeleted: boolean;
}

const DeletedTitle = ({ text, isDeleted }: DeletedTitleProps) => {
  const theme = useTheme();
  return (
    <>
      <span
        style={
          isDeleted
            ? {
                textDecoration: 'line-through',
                textDecorationThickness: '2px',
                color: theme.palette.error.main,
              }
            : {}
        }
      >
        {text}
      </span>
      {isDeleted && (
        <span style={{ color: theme.palette.grey[500], fontSize: '0.8em', marginLeft: '10px' }}>
          (deleted)
        </span>
      )}
    </>
  );
};

export const DeploymentPage = () => {
  const navigate = useNavigate();
  const isStandalone = useIsStandalone();

  const { tab, environment, deploymentId, project, region } = useParams<{
    tab: string;
    environment: string;
    deploymentId: string;
    project: string;
    region: string;
  }>();

  const [selectedTab, setSelectedTab] = useState<string>(tab ?? 'overview');

  const handleTabChange = (index: number) => {
    const next = tabs[index];
    setSelectedTab(next.id);
    navigate(
      `/infraweave/deployment/${project}/${region}/${encodeURIComponent(
        environment ?? '',
      )}/${encodeURIComponent(deploymentId ?? '')}/${next.id}`,
    );
  };

  const { value, loading, error } = useDeployment(project, region, environment, deploymentId);

  if (loading) return <Progress />;
  if (error) return <ResponseErrorPanel error={error} />;

  const isDeleted = !!value?.deleted;
  const headerTitle = isStandalone ? `Deployment - ${value?.deployment_id}` : 'View Deployment';
  const headerSubtitle = `${value?.environment} - ${value?.deployment_id}`;

  return (
    <Page themeId="tool">
      {!isStandalone && (
        <HeaderTabs
          selectedIndex={tabs.findIndex((t) => t.id === selectedTab)}
          onChange={handleTabChange}
          tabs={tabs.map(({ label }, index) => ({ id: tabs[index].id, label }))}
        />
      )}
      <Header
        title={
          <>
            {!isStandalone && (
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/infraweave/deployments')}
                style={{ marginBottom: '8px', color: 'white' }}
              />
            )}
            <DeletedTitle text={headerTitle} isDeleted={isDeleted} />
          </>
        }
        pageTitleOverride={`Deployment - ${value?.deployment_id}`}
        subtitle={
          <span style={isDeleted ? { textDecoration: 'line-through' } : {}}>{headerSubtitle}</span>
        }
      >
        {!isStandalone && (
          <>
            <HeaderLabel label="Owner" value="Team X" />
            <HeaderLabel label="Lifecycle" value="Alpha" />
          </>
        )}
      </Header>
      <Content>
        <Grid container spacing={3}>
          <Grid size={12}>
            {selectedTab === 'overview' && (
              <DeploymentOverview deployment={value} project={project} region={region} />
            )}
            {selectedTab === 'events' && (
              <Grid container spacing={3} style={{ height: '100vh' }}>
                <Grid size={11} style={{ display: 'flex', flexDirection: 'column' }}>
                  <Grid container spacing={3} direction="column" style={{ flexGrow: 1 }}>
                    <AllChangeRecords deployment={value} />
                  </Grid>
                </Grid>
              </Grid>
            )}
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
