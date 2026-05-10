import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Provider } from '../../../types/Provider';
import {
  Grid,
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import { ZipBrowser } from '../../../shared/components/ZipBrowser';
import {
  InfoCard,
  StructuredMetadataTable,
  Link,
  MarkdownContent,
  Content,
  Progress,
  ResponseErrorPanel,
  Header,
  Page,
  HeaderTabs,
} from '../../../standalone/components/ComponentAdapter';
import { useConfig } from '../../../hooks/useConfig';
import { useIsStandalone } from '../../../contexts/ConfigContext';
import useAsync from 'react-use/lib/useAsync';

const tabs = [{ label: 'Information' }];

export const ProviderPage = () => {
  const { providerName, track, providerVersion } = useParams<{
    providerName: string;
    track: string;
    providerVersion: string;
  }>();
  const [selectedTab, setSelectedTab] = useState<number>(0);
  const isStandalone = useIsStandalone();
  const [openZipBrowser, setOpenZipBrowser] = useState(false);
  const [selectedZipUrl, setSelectedZipUrl] = useState<string | null>(null);
  const [selectedModuleName, setSelectedModuleName] = useState<string>('');
  const [selectedModuleVersion, setSelectedModuleVersion] = useState<string>('');

  const handleBrowseClick = (name: string, track: string, version: string) => {
    const encodedName = encodeURIComponent(name);
    const encodedVersion = encodeURIComponent(version);
    const url = config.getApiUrl(
      `api/proxy/api/infraweave/api/v1/provider/${track}/${encodedName}/${encodedVersion}/download`,
    );
    setSelectedZipUrl(url);
    setSelectedModuleName(name);
    setSelectedModuleVersion(version);
    setOpenZipBrowser(true);
  };

  const config = useConfig();
  const { value, loading, error } = useAsync(async (): Promise<Provider> => {
    const encodedName = encodeURIComponent(providerName ?? '');
    const encodedVersion = encodeURIComponent(providerVersion ?? '');

    const response = await config.fetch(
      config.getApiUrl(
        `api/proxy/api/infraweave/api/v1/provider/${track}/${encodedName}/${encodedVersion}`,
      ),
    );

    if (response.status >= 300 && response.status < 400) {
      throw new Error('Redirected to login or guest page');
    }

    if (!response.ok) throw new Error('Failed to fetch provider');

    const json = await response.json();
    return Array.isArray(json) ? json[0] : json;
  }, [track, providerName, providerVersion]);

  const handleTabChange = (index: number) => {
    setSelectedTab(index);
  };

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  const displayName = value?.name ?? providerName;

  // We assume the artifact exists if we have the provider details,
  // as the download URL is constructed from the name/version/track.
  // We fall back to showing the button even if specific keys are missing in the response.
  const browseButton = value ? (
    <Button
      variant="contained"
      color="primary"
      startIcon={<CodeIcon />}
      onClick={() =>
        handleBrowseClick(
          value.name || value.module_name || value.provider_name || providerName || '',
          value.track || track,
          value.version,
        )
      }
    >
      Browse Artifact
    </Button>
  ) : null;

  const renderTabContent = () => {
    switch (selectedTab) {
      case 0: // Information
        return (
          <Content>
            <Grid container spacing={3}>
              <Grid size={12}>
                <InfoCard title="Description">
                  <MarkdownContent content={value?.description || '<No description>'} />
                </InfoCard>
              </Grid>
              <Grid size={12}>
                <InfoCard title="Information">
                  <StructuredMetadataTable
                    metadata={{
                      Provider: value?.name,
                      'Provider Version': value?.version,
                      Track: value?.track || track,
                      Reference: (
                        <Link href={value?.reference} target="_blank">
                          {value?.reference}
                        </Link>
                      ),
                      Created: value?.timestamp,
                      'Provider requirements': (
                        <>
                          {value?.tf_required_providers?.map((provider) => (
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
                          {value?.tf_lock_providers?.map((provider) => (
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
            </Grid>
          </Content>
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

  return (
    <Page themeId="tool">
      {!isStandalone && (
        <HeaderTabs
          selectedIndex={selectedTab}
          onChange={handleTabChange}
          tabs={tabs.map(({ label }, index) => ({
            id: index.toString(),
            label,
          }))}
        />
      )}
      <Header title={displayName} subtitle={`Provider • Version: ${value?.version ?? ''}`}>
        {browseButton}
      </Header>
      {isStandalone ? (
        <Content>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {tabs.map((tab, index) => (
                <Box
                  key={tab.label}
                  onClick={() => handleTabChange(index)}
                  sx={{
                    px: 2,
                    py: 1,
                    cursor: 'pointer',
                    borderBottom: selectedTab === index ? 2 : 0,
                    borderColor: 'primary.main',
                    color: selectedTab === index ? 'primary.main' : 'text.secondary',
                    fontWeight: selectedTab === index ? 600 : 400,
                    '&:hover': {
                      color: 'primary.main',
                    },
                  }}
                >
                  {tab.label}
                </Box>
              ))}
            </Box>
          </Box>
          {renderTabContent()}
        </Content>
      ) : (
        renderTabContent()
      )}
      <Dialog
        open={openZipBrowser}
        onClose={() => setOpenZipBrowser(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Browsing: {selectedModuleName} ({selectedModuleVersion})
            </Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => setOpenZipBrowser(false)}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers style={{ height: '80vh', padding: 0 }}>
          {selectedZipUrl && <ZipBrowser url={selectedZipUrl} height="100%" />}
        </DialogContent>
      </Dialog>
    </Page>
  );
};
