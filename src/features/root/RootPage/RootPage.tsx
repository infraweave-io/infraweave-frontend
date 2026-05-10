import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useIsStandalone } from '../../../contexts/ConfigContext';
import { Typography, Grid, Box, Link } from '@mui/material';
import {
  InfoCard,
  Header,
  Page,
  Content,
  HeaderLabel,
  HeaderTabs,
} from '../../../standalone/components/ComponentAdapter';
import { Deployments } from '../../deployments';
import { Modules } from '../../modules';
import { Overview } from '../../overview';
import { Policies } from '../../policies';
import { Providers } from '../../providers';
import { Stacks } from '../../stacks';
import EnvFilterPanel from './EnvFilterPanel';
import CloudFilterPanel from './CloudFilterPanel';
import { SelectedProjectsProvider } from './SelectedProjectsContext';
import { SelectedProvidersProvider } from './SelectedProvidersContext';
import { Projects } from './Projects';
import { ObservabilityPage } from '../../observability';

const tabs = [
  { label: 'Overview' },
  { label: 'Deployments' },
  { label: 'Stacks' },
  { label: 'Modules' },
  { label: 'Providers' },
  { label: 'Policies' },
  { label: 'Projects' },
  { label: 'Observability' },
];

interface TabLayoutProps {
  title: string;
  description: string;
  detail?: string;
  children: React.ReactNode;
  showEnvFilter?: boolean;
}

const TabLayout: React.FC<TabLayoutProps> = ({
  title,
  description,
  detail,
  children,
  showEnvFilter = false,
}) => (
  <Grid container spacing={3}>
    <Grid size={3}>
      <CloudFilterPanel />
      {showEnvFilter && (
        <>
          <Box p={1} />
          <EnvFilterPanel />
        </>
      )}
    </Grid>
    <Grid size={9}>
      <Grid container spacing={3} direction="column">
        <Grid>
          <InfoCard title={title}>
            <Typography variant="body1">{description}</Typography>
            {detail && (
              <>
                <p />
                <Typography variant="body2">{detail}</Typography>
              </>
            )}
          </InfoCard>
        </Grid>
        <Grid>{children}</Grid>
      </Grid>
    </Grid>
  </Grid>
);

export const RootPage = () => {
  const { tab } = useParams<{ tab: string }>() as { tab: string };
  const { pathname } = useLocation();
  const isStandalone = useIsStandalone();

  const initialTab = tab || 'overview';
  const [selectedTab, setSelectedTab] = useState<string>(initialTab);

  useEffect(() => {
    if (tab) {
      setSelectedTab(tab);
    } else if (pathname.includes('/infraweave/observability')) {
      setSelectedTab('observability');
    }
  }, [tab, pathname]);

  const navigate = useNavigate();
  const handleTabChange = (index: number) => {
    const tabLabel = tabs[index].label.toLowerCase();
    setSelectedTab(tabLabel);
    navigate(`/infraweave/${tabLabel}`);
  };

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'overview':
        return (
          <>
            <InfoCard title="Overview">
              <Typography variant="h6">About the tool</Typography>
              <Typography paragraph>
                Read more <Link href="https://preview.infraweave.io/">here</Link> about InfraWeave
              </Typography>
            </InfoCard>
            <Box mt={2} />
            <Overview />
          </>
        );
      case 'deployments':
        return (
          <TabLayout
            title="Deployments"
            description="A deployment is a deployment of a single module or a stack."
            detail="This list shows the status of all deployments, including the status of the deployment, the environment it is deployed in, the module and version, and the number of dependencies."
            showEnvFilter
          >
            <Deployments />
          </TabLayout>
        );
      case 'stacks':
        return (
          <TabLayout
            title="Stacks"
            description="Stacks are collections of linked modules that are deployed as one, following a golden path."
            detail="There are many combinations of modules which are impossible to test, these are following the recommended standard, are thouroughly tested (including upgrades) and are known to work well together."
          >
            <Stacks />
          </TabLayout>
        );
      case 'modules':
        return (
          <TabLayout
            title="Modules"
            description="A module is a defined as a collection of resources that are deployed together in a single terraform module."
            detail="This list shows the latest version of each module and information about the module. You can see more details about the module by clicking on the module name."
          >
            <Modules />
          </TabLayout>
        );
      case 'providers':
        return (
          <TabLayout
            title="Providers"
            description="Providers are Terraform providers that are used to manage infrastructure resources across different cloud platforms."
            detail="This list shows the latest version of each provider and information about the provider. You can see more details about the provider by clicking on the provider name."
          >
            <Providers />
          </TabLayout>
        );
      case 'policies':
        return (
          <TabLayout
            title="Policies"
            description="Policies are used to enforce rules and standards for the infrastructure and are applied to all deployments."
            detail="This list shows the current version of each policy and information about the policy. You can see more details about the policy by clicking on the policy name."
          >
            <Policies />
          </TabLayout>
        );
      case 'projects':
        return (
          <TabLayout
            title="Projects"
            description="A project is the separation between different environments and products such as dev, staging, and prod for a specific product. In AWS it would be a separate account, in Azure a separate subscription etc."
          >
            <Projects />
          </TabLayout>
        );
      case 'observability':
        return <ObservabilityPage />;
      default:
        return (
          <InfoCard title="Nothing here">
            <Typography variant="body1">Select a tab to view content.</Typography>
          </InfoCard>
        );
    }
  };

  return (
    <SelectedProvidersProvider>
      <SelectedProjectsProvider>
        <Page themeId="tool">
          {!isStandalone && (
            <HeaderTabs
              selectedIndex={tabs.findIndex((t) => t.label.toLowerCase() === selectedTab) ?? 0}
              onChange={handleTabChange}
              tabs={tabs.map(({ label }, index) => ({
                id: index.toString(),
                label,
              }))}
            />
          )}
          <Header title="InfraWeave Overview" subtitle="Handle infrastructure">
            <HeaderLabel label="Owner" value="Team X" />
            <HeaderLabel label="Lifecycle" value="Alpha" />
          </Header>
          <Content>
            <Grid container spacing={3}>
              <Grid size={12}>
                {/* Render content based on the selected tab */}
                {renderTabContent()}
              </Grid>
            </Grid>
          </Content>
        </Page>
      </SelectedProjectsProvider>
    </SelectedProvidersProvider>
  );
};
