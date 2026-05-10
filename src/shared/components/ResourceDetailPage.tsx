import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Module } from '../../types/Module';
import { ResourcePage } from './ResourcePage';
import { InformationTab, UsageTab } from './ResourceTabs';
import {
  Grid,
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Collapse,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import CodeIcon from '@mui/icons-material/Code';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import {
  InfoCard,
  CodeSnippet,
  MarkdownContent,
} from '../../standalone/components/ComponentAdapter';
import { ModuleVersions, DeploymentsDialog } from '../../features/modules/detail/ModuleVersions';
import { SelectedProjectProvider } from './DeploySelectedContext';
import { VariableProvider } from './DeployVariableContext';
import DeployResourceDialog from './DeployResourceDialog';
import { useConfig } from '../../hooks/useConfig';
import { useAvailableTracks } from '../../hooks/useAvailableTracks';
import { useZipBrowser } from '../../hooks/useZipBrowser';
import { ZipBrowser } from './ZipBrowser';
import { CompareVersionsDialog } from '../../features/modules/detail/CompareVersionsDialog';
import { toYamlString } from '../../utils/yaml';
const DeploymentVariableSettings = React.lazy(() => import('./DeployVariableSettings'));

const tabs = [
  { label: 'Information' },
  { label: 'Examples' },
  { label: 'Versions' },
  { label: 'Usage' },
];

interface ResourceDetailPageProps {
  resourceType: 'module' | 'stack';
}

export const ResourceDetailPage: React.FC<ResourceDetailPageProps> = ({ resourceType }) => {
  const isModule = resourceType === 'module';
  const versionKey = isModule ? 'moduleVersion' : 'stackVersion';
  const resourceLabel = isModule ? 'module' : 'stack';
  const ResourceLabel = isModule ? 'Module' : 'Stack';

  const {
    moduleName,
    stackName,
    track: currentTrack,
  } = useParams<{
    moduleName: string;
    stackName: string;
    track: string;
  }>();
  const resourceName = isModule ? moduleName : stackName;

  const [view, setView] = useState('manifest');
  const [openDialog, setOpenDialog] = useState(false);
  const [openVersionsModal, setOpenVersionsModal] = useState(false);
  const [exampleIndex, setExampleIndex] = useState<number>(-1);
  const [openCompareDialog, setOpenCompareDialog] = useState(false);
  const [initialCompareVersion, setInitialCompareVersion] = useState<string | undefined>(undefined);
  const [initialCompareTrack, setInitialCompareTrack] = useState<string | undefined>(undefined);
  const [openDeployments, setOpenDeployments] = useState(false);
  const [deploymentsVersion, setDeploymentsVersion] = useState('');
  const [showExampleClaim, setShowExampleClaim] = useState(false);
  const [selectedExampleIndex, setSelectedExampleIndex] = useState(0);
  const config = useConfig();

  const zipBrowser = useZipBrowser();
  const { availableTracks, selectedTrack, setSelectedTrack } = useAvailableTracks(
    resourceName,
    resourceLabel,
    config,
    openVersionsModal,
    currentTrack || 'stable',
  );

  // Keep selectedTrack in sync with URL param on initial load
  useEffect(() => {
    if (currentTrack) {
      setSelectedTrack(currentTrack);
    }
  }, [currentTrack, setSelectedTrack]);

  const handleToggle = (_event: React.MouseEvent<HTMLElement>, newView: string | null): void => {
    if (newView !== null) {
      setView(newView);
    }
  };

  const handleBrowseClick = (name: string, track: string, version: string) => {
    const encodedName = encodeURIComponent(name);
    const encodedVersion = encodeURIComponent(version);
    const url = config.getApiUrl(
      `api/proxy/api/infraweave/api/v1/${resourceLabel}/${track}/${encodedName}/${encodedVersion}/download`,
    );
    zipBrowser.browse(url, name, version);
  };

  const headerActions = (data: Module | undefined) => {
    if (!data?.s3_key) return null;
    return (
      <Box display="flex" gap={1}>
        {data?.manifest?.spec?.examples && data.manifest.spec.examples.length > 0 && (
          <Button
            startIcon={<InfoIcon />}
            variant="outlined"
            color="primary"
            onClick={() => setShowExampleClaim(!showExampleClaim)}
          >
            {showExampleClaim ? 'Hide' : 'Show'} Example Claim
          </Button>
        )}
        <Button
          variant="contained"
          color="primary"
          startIcon={<CodeIcon />}
          onClick={() =>
            handleBrowseClick(data.module || data.module_name || '', data.track, data.version)
          }
        >
          Browse Artifact
        </Button>
        {isModule && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudQueueIcon />}
            onClick={() => {
              setDeploymentsVersion(data.version);
              setOpenDeployments(true);
            }}
          >
            Deployments
          </Button>
        )}
      </Box>
    );
  };

  const renderExampleClaimYaml = (value: Module): string => {
    const example = value.manifest.spec.examples?.[selectedExampleIndex];
    const randomSuffix = Array.from({ length: 4 }, () =>
      String.fromCharCode(97 + Math.floor(Math.random() * 26)),
    ).join('');

    if (example) {
      const variablesYaml = isModule
        ? Object.entries(example.variables)
            .map(
              ([key, val]) =>
                `    ${key}: ${typeof val === 'string' ? `"${val}"` : JSON.stringify(val)}`,
            )
            .join('\n')
        : toYamlString(example.variables, 4).trimEnd();

      return `apiVersion: infraweave.io/v1
kind: ${value.module_name || `<${ResourceLabel.toUpperCase()}_NAME>`}
metadata:
  name: ${example.name}-${randomSuffix}
spec:
  region: us-east-1
  ${versionKey}: ${value.version || '<VERSION>'}
  variables:
${variablesYaml}`;
    }

    return `apiVersion: infraweave.io/v1
kind: ${value.module_name || `<${ResourceLabel.toUpperCase()}_NAME>`}
metadata:
  name: <DEPLOYMENT_ID>-xkqm
spec:
  region: <REGION>
  ${versionKey}: ${value.version || '<VERSION>'}
  variables:
    key1: value1
    key2: value2`;
  };

  const renderTabContent = (value: Module | undefined, selectedTab: number) => {
    const content = (() => {
      switch (selectedTab) {
        case 0: // Information
          return (
            <>
              {value?.deprecated && (
                <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>This {resourceLabel} version is deprecated</strong>
                  </Typography>
                  {value.deprecated_message ? (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {value.deprecated_message}
                    </Typography>
                  ) : (
                    <Typography variant="body2">
                      This version is no longer recommended for use. Please consider upgrading to a
                      newer version.
                    </Typography>
                  )}
                </Alert>
              )}
              <Collapse in={showExampleClaim}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  {value?.manifest?.spec?.examples && value.manifest.spec.examples.length > 0 && (
                    <>
                      {value.manifest.spec.examples.length > 1 && (
                        <Box mb={2}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            mb={1}
                          >
                            Select Example:
                          </Typography>
                          <ToggleButtonGroup
                            value={selectedExampleIndex}
                            exclusive
                            onChange={(_, newIndex) => {
                              if (newIndex !== null) {
                                setSelectedExampleIndex(newIndex);
                              }
                            }}
                            size="small"
                            fullWidth
                          >
                            {value.manifest.spec.examples.map((example, index) => (
                              <ToggleButton key={index} value={index}>
                                {example.name}
                              </ToggleButton>
                            ))}
                          </ToggleButtonGroup>
                        </Box>
                      )}
                      <Typography variant="subtitle2" gutterBottom>
                        Example {ResourceLabel} Claim Format
                        {value.manifest.spec.examples.length > 1
                          ? ` (${value.manifest.spec.examples[selectedExampleIndex].name})`
                          : ` (based on "${value.manifest.spec.examples[0].name}" example)`}
                        :
                      </Typography>
                    </>
                  )}
                  {value && (
                    <CodeSnippet
                      language="yaml"
                      showLineNumbers
                      showCopyCodeButton
                      text={renderExampleClaimYaml(value)}
                    />
                  )}
                </Alert>
              </Collapse>
              <InformationTab
                data={value}
                view={view}
                onViewChange={handleToggle}
                resourceType={resourceType}
              />
            </>
          );

        case 1: // Examples
          return (
            <Grid container spacing={3}>
              <Grid size={12}>
                <InfoCard title="Examples">
                  <Typography variant="body1">
                    View examples of how to use this {resourceLabel} version.
                  </Typography>
                </InfoCard>
                <Box p={1} />
                {value?.manifest.spec.examples?.map((example, index) => (
                  <div key={`variable-provider-${example.name}-${value.module_name}`}>
                    {resourceName != null && exampleIndex === index && (
                      <React.Suspense fallback={null}>
                        <SelectedProjectProvider>
                          <VariableProvider
                            example={example}
                            key={`variable-provider-${example.name}-${value.module_name}`}
                          >
                            <DeployResourceDialog
                              openDialog={openDialog}
                              setOpenDialog={setOpenDialog}
                              deployModule={() => {}}
                              module={value!}
                              example={example}
                              resourceType={resourceType}
                              VariableSettings={DeploymentVariableSettings}
                            />
                          </VariableProvider>
                        </SelectedProjectProvider>
                      </React.Suspense>
                    )}
                    <InfoCard>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6">{example.name}</Typography>
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => {
                            setExampleIndex(index);
                            setOpenDialog(true);
                          }}
                        >
                          Deploy
                        </Button>
                      </Box>
                      <Box mt={2}>
                        <MarkdownContent content={example.description || ''} />
                      </Box>
                      <Box mt={2}>
                        <CodeSnippet
                          language="yaml"
                          text={`variables:\n${Object.entries(example.variables)
                            .map(([key, val]) => `  ${key}: ${JSON.stringify(val)}`)
                            .join('\n')}`}
                          showCopyCodeButton
                        />
                      </Box>
                    </InfoCard>
                    <Box p={1} />
                  </div>
                ))}
              </Grid>
            </Grid>
          );

        case 2: // Versions
          return (
            <Grid container spacing={3}>
              <Grid size={12}>
                <ModuleVersions
                  module={value?.module}
                  track={value?.track}
                  resourceType={resourceType}
                  hideChanges={!isModule}
                />
              </Grid>
            </Grid>
          );

        case 3: // Usage
          return <UsageTab data={value} resourceType={resourceType} />;

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
    })();

    return (
      <>
        {content}
        {openCompareDialog && value && (
          <CompareVersionsDialog
            open={openCompareDialog}
            onClose={() => {
              setOpenCompareDialog(false);
              setInitialCompareVersion(undefined);
              setInitialCompareTrack(undefined);
            }}
            currentModule={value}
            resourceType={resourceType}
            initialCompareVersion={initialCompareVersion}
            initialCompareTrack={isModule ? initialCompareTrack : undefined}
          />
        )}
      </>
    );
  };

  return (
    <>
      <ResourcePage
        resourceType={resourceType}
        renderTabContent={renderTabContent}
        tabs={tabs}
        headerActions={(data) => (
          <Box display="flex" gap={1}>
            {headerActions(data)}
            <Button variant="contained" color="primary" onClick={() => setOpenVersionsModal(true)}>
              Versions
            </Button>
          </Box>
        )}
      />

      {/* Artifact ZIP browser dialog */}
      <Dialog open={zipBrowser.open} onClose={zipBrowser.close} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Browsing: {zipBrowser.resourceName} ({zipBrowser.resourceVersion})
            </Typography>
            <IconButton edge="end" color="inherit" onClick={zipBrowser.close} aria-label="close">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers style={{ height: '80vh', padding: 0 }}>
          {zipBrowser.url && <ZipBrowser url={zipBrowser.url} height="100%" />}
        </DialogContent>
      </Dialog>

      {/* Versions modal */}
      <Dialog
        open={openVersionsModal}
        onClose={() => setOpenVersionsModal(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{resourceName} - Versions</Typography>
            <IconButton
              edge="end"
              color="inherit"
              onClick={() => setOpenVersionsModal(false)}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box
            mb={2}
            display="flex"
            flexDirection="column"
            alignItems="center"
            sx={{
              position: 'sticky',
              top: 0,
              backgroundColor: 'background.paper',
              zIndex: 3,
              paddingTop: 2,
              paddingBottom: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary" mb={1}>
              Track (maturity level)
            </Typography>
            <ToggleButtonGroup
              value={selectedTrack}
              exclusive
              onChange={(_, newTrack) => {
                if (newTrack !== null) setSelectedTrack(newTrack);
              }}
              aria-label="track selection"
            >
              {availableTracks.map((track) => (
                <ToggleButton key={track} value={track} aria-label={track}>
                  {track.charAt(0).toUpperCase() + track.slice(1)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          <ModuleVersions
            module={resourceName}
            track={selectedTrack}
            resourceType={resourceType}
            hideChanges={!isModule}
            hideTitle
            onVersionClick={() => setOpenVersionsModal(false)}
            onCompare={(version, track) => {
              setOpenVersionsModal(false);
              setInitialCompareVersion(version);
              if (isModule) setInitialCompareTrack(track);
              setOpenCompareDialog(true);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Module-only: Deployments dialog */}
      {isModule && (
        <DeploymentsDialog
          open={openDeployments}
          onClose={() => setOpenDeployments(false)}
          moduleName={resourceName || ''}
          version={deploymentsVersion}
        />
      )}
    </>
  );
};
