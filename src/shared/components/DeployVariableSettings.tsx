import React, { useState } from 'react';
import camelCase from 'camelcase';
import {
  TextField,
  Checkbox,
  IconButton,
  Typography,
  Link,
  FormGroup,
  FormControlLabel,
  Alert,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import CodeMirror from '@uiw/react-codemirror';
import { Module, ModuleExample, TfVariable } from '../../types/Module';
import { useVariables } from './DeployVariableContext';
import ModuleVariablePopover from '../../features/modules/detail/ModuleVariablePopOver';

const VariableInputItem = ({
  variable,
  variablesSnakecaseFlat,
  setVariable,
  setHasInvalidVariables,
}: {
  variable: TfVariable;
  variablesSnakecaseFlat: Record<string, any>;
  setVariable: (name: string, value: any) => void;
  setHasInvalidVariables: (value: boolean) => void;
}) => {
  const [isValidJson, setIsValidJson] = useState(true);
  const variableName = camelCase(variable.name);

  const renderVariableInput = () => {
    switch (variable.type) {
      case 'string':
        return (
          <TextField
            fullWidth
            label={variable.name}
            value={variablesSnakecaseFlat[variableName] || ''}
            onChange={(e) => setVariable(variable.name, e.target.value)}
            variant="outlined"
          />
        );
      case 'bool':
        return (
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={variablesSnakecaseFlat[variableName] || false}
                  onChange={(e) => setVariable(variable.name, e.target.checked)}
                  color="primary"
                />
              }
              label={variable.name}
            />
          </FormGroup>
        );
      case 'number':
        return (
          <TextField
            fullWidth
            label={variable.name}
            value={variablesSnakecaseFlat[variableName] || ''}
            onChange={(e) => setVariable(variable.name, parseFloat(e.target.value))}
            type="number"
            variant="outlined"
          />
        );
      case 'map':
      case 'list':
      default: {
        const jsonValue =
          typeof variablesSnakecaseFlat[variableName] === 'string'
            ? variablesSnakecaseFlat[variableName]
            : JSON.stringify(variablesSnakecaseFlat[variableName] || {}, null, 2);

        return (
          <div style={{ marginBottom: '15px', width: '100%' }}>
            <Typography variant="subtitle2" gutterBottom>
              {variable.name} (JSON format):
            </Typography>
            <div style={{ height: '150px', width: '100%', overflow: 'auto' }}>
              <CodeMirror
                title={variable.name}
                value={jsonValue}
                onChange={(value) => {
                  try {
                    const parsedValue = JSON.parse(value);
                    setVariable(variable.name, parsedValue);
                    setIsValidJson(true);
                    setHasInvalidVariables(false);
                  } catch {
                    setIsValidJson(false);
                    setHasInvalidVariables(true);
                  }
                }}
                style={{
                  height: '100%',
                  width: '100%',
                  fontSize: '14px',
                  padding: '10px',
                  borderRadius: '5px',
                  border: '1px solid #ddd',
                }}
              />
            </div>
            {!isValidJson && (
              <Alert severity="error" style={{ marginTop: '10px' }}>
                Invalid JSON format. Please check your syntax.
              </Alert>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div
      style={{
        marginTop: '15px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {renderVariableInput()}
      <ModuleVariablePopover variable={variable}>
        <IconButton>
          <InfoIcon color="primary" />
        </IconButton>
      </ModuleVariablePopover>
    </div>
  );
};

const DeploymentVariableSettings = ({
  module,
  moduleName,
}: {
  module: Module;
  example: ModuleExample;
  moduleName: string;
}) => {
  const { variables, setVariable, setHasInvalidVariables } = useVariables();

  const variables_snakecase_flat = Object.entries(variables).reduce(
    (acc, [key, value]) => {
      if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          acc[camelCase(`${key}__${subKey}`)] = subValue;
        });
      } else {
        acc[camelCase(key)] = value;
      }
      return acc;
    },
    {} as Record<string, any>,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Typography>Please set variables for this deployment:</Typography>

      {module.tf_variables
        ?.filter((variable) => camelCase(variable.name) in variables_snakecase_flat)
        .map((variable: TfVariable, index: React.Key | null | undefined) => (
          <VariableInputItem
            key={index}
            variable={variable}
            variablesSnakecaseFlat={variables_snakecase_flat}
            setVariable={setVariable}
            setHasInvalidVariables={setHasInvalidVariables}
          />
        ))}

      <br />
      <Typography variant="body2">
        Click{' '}
        <Link
          href={`http://localhost:3000/infraweave/${module.module_type}/${module.module}/${module.module}`}
          target="_blank"
        >
          here
        </Link>{' '}
        to browse {moduleName} in a new window.
      </Typography>
    </div>
  );
};

export default DeploymentVariableSettings;
