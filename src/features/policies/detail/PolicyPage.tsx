import React, { useState } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Typography, Grid, Box, Button, Card, CardContent, CardHeader } from '@mui/material';
import {
  InfoCard,
  Progress,
  ResponseErrorPanel,
  StructuredMetadataTable,
  CodeSnippet,
  MarkdownContent,
  Header,
  Page,
  Content,
  HeaderLabel,
  HeaderTabs,
} from '../../../standalone/components/ComponentAdapter';
import { Policy } from '../../../types/Policy';
import { useParams } from 'react-router-dom';
import useAsync from 'react-use/lib/useAsync';
import { useNavigate } from 'react-router-dom';

export const PolicyPage = () => {
  const navigate = useNavigate();
  const { policyName, policyVersion, environment } = useParams<{
    policyName: string;
    policyVersion: string;
    environment: string;
  }>();

  const config = useConfig();
  const { value, loading, error } = useAsync(async (): Promise<Policy> => {
    const encodedPolicyName = encodeURIComponent(policyName ?? '');
    const encodedPolicyVersion = encodeURIComponent(policyVersion ?? '');
    const encodedEnvironment = encodeURIComponent(environment ?? '');

    // Using config.getApiUrl() instead of backendBaseUrl
    const response = await config.fetch(
      config.getApiUrl(
        `api/proxy/api/infraweave/api/v1/policy/${encodedEnvironment}/${encodedPolicyName}/${encodedPolicyVersion}`,
      ),
    );

    if (response.status >= 300 && response.status < 400) {
      throw new Error('Redirected to login or guest page');
    }

    const json = await response.json();
    return json;
  }, []);

  const [selectedTab, setSelectedTab] = useState<number>(0);

  const tabs = [
    { label: 'Information' },
    // { label: 'Versions' },
    // { label: 'Development guidance' },
    // { label: 'Compliance Advisor' },
  ];

  const renderTabContent = () => {
    switch (selectedTab) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid size={6}>
              <InfoCard title="Policy Information">
                <StructuredMetadataTable
                  metadata={{
                    Policy: value?.policy,
                    'Policy Version': value?.version,
                    Environment: value?.environment,
                    Reference: value?.reference,
                    Created: value?.timestamp,
                  }}
                />
              </InfoCard>
            </Grid>
            <Grid size={6}>
              <InfoCard title="Description">
                <MarkdownContent content={value?.description || '<No description>'} />
              </InfoCard>
            </Grid>
            <Grid size={12}>
              <PolicySettings policy={value} />
            </Grid>
          </Grid>
        );
      case 1:
        return (
          <Grid container spacing={3}>
            <Grid size={12}>
              <InfoCard title="Versions">
                <Typography variant="body1">
                  These are all existing versions of the policy.
                </Typography>
              </InfoCard>
            </Grid>
          </Grid>
        );
      case 2:
        return (
          <Grid container spacing={3}>
            <Grid size={12}>
              <InfoCard title="Usage Examples">
                <Typography variant="body1">
                  Here you can view examples of how to use this policy.
                </Typography>
              </InfoCard>
            </Grid>
          </Grid>
        );
      case 3:
        return (
          <Grid container spacing={3}>
            <Grid size={12}>
              <InfoCard title="Version Popularity">
                <Typography variant="body1">View usage distribution of policy versions.</Typography>
              </InfoCard>
              <Box p={2} />
              <InfoCard title="Live Deployments">
                <Typography variant="body1">
                  Here you can see all live deployments of this policy version.
                </Typography>
              </InfoCard>
            </Grid>
          </Grid>
        );
      case 4:
        return (
          <Grid container spacing={3}>
            <Grid size={12}>
              <InfoCard title="Test">
                <Typography variant="body1">This is the test content.</Typography>
              </InfoCard>
            </Grid>
          </Grid>
        );
      case 5:
        return (
          <Grid container spacing={3}>
            <Grid size={12}>
              <InfoCard title="Compliance Advisor">
                <Typography variant="body1">This is the compliance advisor content.</Typography>
              </InfoCard>
            </Grid>
          </Grid>
        );
      default:
        return (
          <Grid container spacing={3}>
            <Grid size={12}>
              <InfoCard title="Default Content">
                <Typography variant="body1">Select a tab to view content.</Typography>
              </InfoCard>
            </Grid>
          </Grid>
        );
    }
  };

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <Page themeId="tool">
      <Header
        title={
          <>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(-1)}
              style={{ marginBottom: '8px', color: 'white' }}
            />
            View Policy
          </>
        }
        pageTitleOverride={`Policy - ${value?.policy}`}
        subtitle={`${value?.policy} - ${value?.version}`}
      >
        <HeaderLabel label="Owner" value="Team X" />
        <HeaderLabel label="Lifecycle" value="Alpha" />
      </Header>

      <HeaderTabs
        selectedIndex={selectedTab}
        onChange={(index) => setSelectedTab(index)}
        tabs={tabs.map(({ label }, index) => ({
          id: index.toString(),
          label,
        }))}
      />

      <Content>
        <Grid container spacing={3}>
          <Grid size={12}>{renderTabContent()}</Grid>
        </Grid>
      </Content>
    </Page>
  );
};

export const PolicySettings = (props: { policy?: Policy } = { policy: undefined }) => {
  const { policy } = props;

  return (
    <Box display="flex" flexDirection="column" flexBasis="50%">
      <InfoCard title="Policy Settings">
        <Box display="flex" flexDirection="column" padding={2}>
          {Object.entries(policy?.data ?? {}).map(([key, value]) => (
            <Card
              key={key}
              style={{
                padding: '16px',
                border: '1px solid #e0e0e0',
                backgroundColor: '#fafafa',
                borderRadius: '8px',
                boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)', // Subtle shadow for depth
                transition: 'transform 0.2s ease-in-out', // Smooth hover effect
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <CardHeader
                title={key}
                titleTypographyProps={{ variant: 'h6', style: { fontWeight: 'bold' } }}
              />
              <CardContent>
                <CodeSnippet
                  language="json"
                  showCopyCodeButton
                  text={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                />
              </CardContent>
            </Card>
          ))}
        </Box>
      </InfoCard>
    </Box>
  );
};
