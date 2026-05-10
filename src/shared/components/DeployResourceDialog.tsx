import React, { useState } from 'react';
import {
  SimpleStepper,
  SimpleStepperStep,
  CodeSnippet,
} from '../../standalone/components/ComponentAdapter';
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
} from '@mui/material';
import { Module, ModuleExample } from '../../types/Module';
import EnvFilterPanel from './DeployEnvFilterPanel';
import { useSelectedProject } from './DeploySelectedContext';
import { useVariables } from './DeployVariableContext';
import createGitlabMergeRequestWithFile from '../../mergerequest/gitlab';
import createGithubMergeRequestWithFile from '../../mergerequest/github';
import { toYamlString } from '../../utils/yaml';
import { MergeRequestOptions } from '../../types/MergeRequest';

// Variable settings are dynamically imported per resource type to preserve context wiring
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
  const args = { activeStep: 0 };

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
        fileContent: `
apiVersion: infraweave.io/v1
kind: ${module.module_name}
metadata:
  name: ${deployment_id}
  namespace: ${environment}
spec:
  region: ${selectedRegion}
  ${versionKey}: ${module?.version ?? '<SPECIFY_VERSION>'}
  variables:
${toYamlString(variables, 4)}
`,
        commitMessage: `Add deployment manifest for ${deployment_id} to ${environment}`,
      });

      setMergeRequestUrl(mergeRequest.web_url);
    } catch (error) {
      console.error('Error creating merge request:', error);
      setIsClicked(false);
    }
  };

  return (
    <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth disableEnforceFocus>
      <DialogTitle>
        Deploy instance of {module.module} (<span style={{ color: 'navy' }}>{module.version}</span>)
      </DialogTitle>
      <DialogContent>
        <Typography>
          Project: <span style={{ color: 'navy' }}>{selectedProjectName}</span>
        </Typography>
        <Typography>
          Repository:{' '}
          <span style={{ color: 'navy' }}>{selectedRepositoryData?.repository_path}</span>
        </Typography>
        <Typography>
          Region: <span style={{ color: 'navy' }}>{selectedRegion}</span>
        </Typography>
        {deployment_id !== '' && (
          <Typography>
            Deployment ID: <span style={{ color: 'navy' }}>{deployment_id}</span>
          </Typography>
        )}
        {environment !== '' && (
          <Typography>
            Environment: <span style={{ color: 'navy' }}>{environment}</span>
          </Typography>
        )}
        <SimpleStepper {...args}>
          <SimpleStepperStep
            title="Destination"
            actions={{
              canNext: () => selectedProjectName !== '' && selectedRepositoryData !== null,
            }}
          >
            <div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                Please set a destination for this deployment:
                <br />
                <EnvFilterPanel />
                <br />
              </div>
              <br />
            </div>
          </SimpleStepperStep>
          <SimpleStepperStep
            title="Deployment configuration"
            actions={{
              canNext: () =>
                deployment_id.length >= 3 && environment.length >= 3 && selectedRegion !== null,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              Please set a name for this deployment:
              <br />
              <br />
              <TextField
                label="Deployment ID"
                value={deployment_id}
                onChange={(e) => setDeploymentId(e.target.value)}
              />
              <br />
              <TextField
                label="Environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
              />
              <br />
              <Box mt={2} />
              <Typography variant="subtitle1">Select Region:</Typography>
              <br />
              <Autocomplete
                value={selectedRegion}
                options={availableRegions}
                onChange={(_event, newValue) => {
                  if (newValue !== null) setRegionSelection(newValue);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Regions" variant="outlined" />
                )}
              />
            </div>
          </SimpleStepperStep>
          <SimpleStepperStep
            title="Set variables"
            actions={{
              canNext: () => !hasInvalidVariables,
            }}
          >
            <VariableSettings module={module} example={example} moduleName={module.module_name} />
          </SimpleStepperStep>
          <SimpleStepperStep title="Verify changes">
            <div>
              This version introduces following changes:
              <CodeSnippet
                language="yaml"
                showLineNumbers
                showCopyCodeButton
                text={`
# Example claim for deploying a ${resourceType}
apiVersion: infraweave.io/v1
kind: ${module.module_name}
metadata:
  name: ${deployment_id}
  namespace: ${environment}
spec:
  region: ${selectedRegion}
  ${versionKey}: ${module?.version ?? 'defaultVersion'}
  variables:
${toYamlString(variables, 4)}
    `}
              />
            </div>
          </SimpleStepperStep>
          <SimpleStepperStep title="Finish" actions={{ showNext: false, showBack: false }} end>
            <div>
              <br />
              <Typography>
                Click the button below to initiate a merge request for creating this manifest
              </Typography>
              <br />
              {!mergeRequestUrl ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleCreateMergeRequest}
                  disabled={isClicked}
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
            </div>
          </SimpleStepperStep>
        </SimpleStepper>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenDialog(false)} color="primary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeployResourceDialog;
