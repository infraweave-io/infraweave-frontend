import React from 'react';
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
import { JobDrawer } from './jobDrawer';
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

const DeploymentPageContent = () => {
  const navigate = useNavigate();
  const isStandalone = useIsStandalone();

  const { tab, environment, deploymentId, project, region } = useParams<{
    tab: string;
    environment: string;
    deploymentId: string;
    project: string;
    region: string;
  }>();

  // The route owns the tab, so a link to another tab of this deployment shows it too.
  const selectedTab = tab ?? 'overview';

  const handleTabChange = (index: number) => {
    const next = tabs[index];
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
      <JobDrawer deployment={value} />
    </Page>
  );
};

export const DeploymentPage = () => {
  const { project, region, environment, deploymentId } = useParams<{
    project: string;
    region: string;
    environment: string;
    deploymentId: string;
  }>();
  // A link to another deployment keeps this component mounted, and useDeployment refreshes a
  // loaded deployment silently, so a failed load would leave the previous one on screen. Keying
  // by the deployment makes it a fresh load that shows its own loading state and errors. The tab
  // stays out of the key: switching tabs must not reload.
  const deployment = [project, region, environment, deploymentId].join('/');
  return <DeploymentPageContent key={deployment} />;
};
