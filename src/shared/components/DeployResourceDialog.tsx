import React, { useEffect, useMemo, useState } from 'react';
import {
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Autocomplete,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CodeMirror from '@uiw/react-codemirror';
import { MONO_FONT } from '../../contexts/ThemeContext';
import { Module, ModuleExample } from '../../types/Module';
import EnvFilterPanel from './DeployEnvFilterPanel';
import { useSelectedProject } from './DeploySelectedContext';
import { useVariables } from './DeployVariableContext';
import createGitlabMergeRequestWithFile from '../../mergerequest/gitlab';
import createGithubMergeRequestWithFile from '../../mergerequest/github';
import { toYamlString } from '../../utils/yaml';
import { MergeRequestOptions } from '../../types/MergeRequest';

// Variable settings are dynamically imported per resource type to preserve context wiring

interface BuildManifestArgs {
  moduleName: string;
  deploymentId: string;
  environment: string;
  region: string | null;
  versionKey: string;
  version: string | undefined;
  variables: Record<string, any>;
}

// Single source of truth for the generated manifest so the editable preview and the
// file committed to the pull request never drift apart.
const buildManifestYaml = ({
  moduleName,
  deploymentId,
  environment,
  region,
  versionKey,
  version,
  variables,
}: BuildManifestArgs): string =>
  `apiVersion: infraweave.io/v1
kind: ${moduleName}
metadata:
  name: ${deploymentId}
  namespace: ${environment}
spec:
  region: ${region ?? '<SPECIFY_REGION>'}
  ${versionKey}: ${version ?? '<SPECIFY_VERSION>'}
  variables:
${toYamlString(variables, 4)}`;

const STEPS = ['Destination', 'Deployment configuration', 'Review & edit manifest'] as const;

interface DeployResourceDialogProps {
  openDialog: boolean;
  setOpenDialog: (open: boolean) => void;
  deployModule: () => void;
  module: Module;
  example: ModuleExample;
  resourceType: 'module' | 'stack';
  VariableSettings: React.ComponentType<{
    module: Module;
    example: ModuleExample;
    moduleName: string;
  }>;
}

export const DeployResourceDialog: React.FC<DeployResourceDialogProps> = ({
  openDialog,
  setOpenDialog,
  module,
  example,
  resourceType,
  VariableSettings,
}) => {
  const versionKey = resourceType === 'module' ? 'moduleVersion' : 'stackVersion';

  const [deployment_id, setDeploymentId] = useState<string>(
    `${example.name}-${Math.random().toString(36).substring(2, 8)}`,
  );
  const [environment, setEnvironment] = useState<string>('default');

  const {
    selectedProjectName,
    selectedRegion,
    selectedRepositoryData,
    availableRegions,
    getSelectedProject,
    setRegionSelection,
  } = useSelectedProject();

  const { variables, hasInvalidVariables } = useVariables();

  const [isClicked, setIsClicked] = useState(false);
  const [mergeRequestUrl, setMergeRequestUrl] = useState<string | null>(null);

  // Which page of the wizard is visible. Steps are revealed gradually rather than all at once.
  const [activeStep, setActiveStep] = useState(0);

  // The manifest generated from the form fields above. Kept in a memo so the editable
  // preview can re-sync to it until the user takes over the editor.
  const generatedManifest = useMemo(
    () =>
      buildManifestYaml({
        moduleName: module.module_name,
        deploymentId: deployment_id,
        environment,
        region: selectedRegion,
        versionKey,
        version: module?.version,
        variables,
      }),
    [
      module.module_name,
      module?.version,
      deployment_id,
      environment,
      selectedRegion,
      versionKey,
      variables,
    ],
  );

  // Free-form manifest the user can edit before opening the PR. `manifestEdited` freezes
  // the auto-sync once the user has made a manual change so we don't clobber their work.
  const [manifest, setManifest] = useState<string>(generatedManifest);
  const [manifestEdited, setManifestEdited] = useState(false);

  useEffect(() => {
    if (!manifestEdited) {
      setManifest(generatedManifest);
    }
  }, [generatedManifest, manifestEdited]);

  const handleResetManifest = () => {
    setManifest(generatedManifest);
    setManifestEdited(false);
  };

  const handleCreateMergeRequest = async () => {
    setIsClicked(true);

    const deployment_name = deployment_id.replace('/', '-');
    const environment_name = environment.replace('/', '-');

    const project = getSelectedProject();

    if (!project) {
      console.error('No project found');
      setIsClicked(false);
      return;
    }

    if (!selectedRepositoryData) {
      console.error('No repository destination found');
      setIsClicked(false);
      return;
    }

    try {
      const gitProvider = selectedRepositoryData.git_provider;

      type CreateMergeRequestWithFileFn = (options: MergeRequestOptions) => any;

      let createMergeRequestWithFile: CreateMergeRequestWithFileFn;
      if (gitProvider === 'gitlab') {
        createMergeRequestWithFile = createGitlabMergeRequestWithFile;
      } else if (gitProvider === 'github') {
        createMergeRequestWithFile = createGithubMergeRequestWithFile;
      } else {
        console.error('Unsupported git provider:', gitProvider);
        setIsClicked(false);
        return;
      }

      const repositoryPath = selectedRepositoryData.repository_path;
      const mergeRequest = await createMergeRequestWithFile({
        repositoryPath: repositoryPath,
        sourceBranch: `add-${deployment_name}-${environment_name}-manifest`,
        targetBranch: 'main',
        title: `Add deployment manifest for ${deployment_id}`,
        description: 'This merge request adds a manifest file to the project.',
        filePath: `${deployment_name}-${environment_name}.yaml`,
        // Commit exactly what the user reviewed/edited in the manifest editor.
        fileContent: `${manifest.trimEnd()}\n`,
        commitMessage: `Add deployment manifest for ${deployment_id} to ${environment}`,
      });

      setMergeRequestUrl(mergeRequest.web_url);
    } catch (error) {
      console.error('Error creating merge request:', error);
      setIsClicked(false);
    }
  };

  // Whether the current page is complete enough to advance to the next one.
  const canProceed = (): boolean => {
    switch (activeStep) {
      case 0: // Destination
        return selectedProjectName !== '' && selectedRepositoryData !== null;
      case 1: // Deployment configuration + variables
        return (
          deployment_id.length >= 3 &&
          environment.length >= 3 &&
          selectedRegion !== null &&
          !hasInvalidVariables
        );
      default:
        return true;
    }
  };

  const isLastStep = activeStep === STEPS.length - 1;

  const handleClose = () => {
    setOpenDialog(false);
  };

  // Label/value row for the running summary. Values are theme-aware (mono font) rather
  // than the old hardcoded navy, which was invisible against a dark theme.
  const summaryValueSx = { fontFamily: MONO_FONT };

  return (
    <Dialog open={openDialog} onClose={handleClose} fullWidth disableEnforceFocus>
      <DialogTitle>
        Deploy instance of {module.module} (
        <Box component="span" sx={{ fontFamily: MONO_FONT }}>
          {module.version}
        </Box>
        )
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 1, mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Running summary of choices made so far. */}
        {activeStep > 0 && (
          <Box mb={2}>
            {selectedProjectName && (
              <Typography variant="body2">
                Project:{' '}
                <Box component="span" sx={summaryValueSx}>
                  {selectedProjectName}
                </Box>
              </Typography>
            )}
            {selectedRepositoryData?.repository_path && (
              <Typography variant="body2">
                Repository:{' '}
                <Box component="span" sx={summaryValueSx}>
                  {selectedRepositoryData.repository_path}
                </Box>
              </Typography>
            )}
            {selectedRegion && (
              <Typography variant="body2">
                Region:{' '}
                <Box component="span" sx={summaryValueSx}>
                  {selectedRegion}
                </Box>
              </Typography>
            )}
            {deployment_id && (
              <Typography variant="body2">
                Deployment ID:{' '}
                <Box component="span" sx={summaryValueSx}>
                  {deployment_id}
                </Box>
              </Typography>
            )}
            {environment && (
              <Typography variant="body2">
                Environment:{' '}
                <Box component="span" sx={summaryValueSx}>
                  {environment}
                </Box>
              </Typography>
            )}
          </Box>
        )}

        {/* Step 1: Destination — project and repository. */}
        {activeStep === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            Please set a destination for this deployment:
            <br />
            <EnvFilterPanel />
          </div>
        )}

        {/* Step 2: Deployment configuration + variables. */}
        {activeStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Typography>Please set a name for this deployment:</Typography>
            <br />
            <TextField
              label="Deployment ID"
              value={deployment_id}
              onChange={(e) => setDeploymentId(e.target.value)}
            />
            <Box mt={2} />
            <TextField
              label="Environment"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
            />
            <Box mt={2} />
            <Typography variant="subtitle1">Select Region:</Typography>
            <br />
            <Autocomplete
              value={selectedRegion}
              options={availableRegions}
              onChange={(_event, newValue) => {
                if (newValue !== null) setRegionSelection(newValue);
              }}
              renderInput={(params) => <TextField {...params} label="Regions" variant="outlined" />}
            />
            <Box mt={3} />
            <VariableSettings module={module} example={example} moduleName={module.module_name} />
          </div>
        )}

        {/* Step 3: Review & edit the generated manifest, then open the PR. */}
        {activeStep === 2 && (
          <div>
            <Typography gutterBottom>
              Review the generated {resourceType} claim below. You can edit it directly before
              opening the pull request &mdash; this exact content is what gets committed.
            </Typography>
            <Box display="flex" justifyContent="space-between" alignItems="center" mt={1} mb={1}>
              {manifestEdited ? (
                <Typography variant="caption" color="text.secondary">
                  Manually edited &mdash; changes to the fields above no longer update this
                  manifest.
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Auto-generated from your selections above.
                </Typography>
              )}
              <Button
                size="small"
                startIcon={<RestartAltIcon />}
                onClick={handleResetManifest}
                disabled={!manifestEdited}
              >
                Reset to generated
              </Button>
            </Box>
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: '360px',
              }}
            >
              <CodeMirror
                value={manifest}
                onChange={(value) => {
                  setManifest(value);
                  setManifestEdited(true);
                }}
                style={{ fontSize: '14px' }}
              />
            </Box>
            {manifest.trim() === '' && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                The manifest is empty. Add content before creating the pull request.
              </Alert>
            )}
            <Box mt={2}>
              {!mergeRequestUrl ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleCreateMergeRequest}
                  disabled={isClicked || manifest.trim() === ''}
                >
                  Create merge request
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="secondary"
                  href={mergeRequestUrl}
                  target="_blank"
                >
                  View Merge Request
                </Button>
              )}
            </Box>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Cancel
        </Button>
        <Box flexGrow={1} />
        <Button
          onClick={() => setActiveStep((prev) => prev - 1)}
          disabled={activeStep === 0 || Boolean(mergeRequestUrl)}
        >
          Back
        </Button>
        {!isLastStep && (
          <Button
            variant="contained"
            onClick={() => setActiveStep((prev) => prev + 1)}
            disabled={!canProceed()}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DeployResourceDialog;
