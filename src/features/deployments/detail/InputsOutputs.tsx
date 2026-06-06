import React from 'react';
import { useConfig } from '../../../hooks/useConfig';
import { Typography, Box, Card, CardContent, Chip, Tooltip, IconButton } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CodeIcon from '@mui/icons-material/Code';
import DataObjectIcon from '@mui/icons-material/DataObject';
import {
  InfoCard,
  Progress,
  ResponseErrorPanel,
} from '../../../standalone/components/ComponentAdapter';
import { Module } from '../../../types/Module';
import { Deployment } from '../../../types/Deployment';
import { useAsync } from '../../../hooks/useAsync';

export const InputsOutputs = (props: { deployment?: Deployment } = { deployment: undefined }) => {
  const [formatMode, setFormatMode] = React.useState<'yaml' | 'json'>('yaml');

  const snakeToCamelCase = (str: string) => {
    if (str === null || str === undefined) {
      return str;
    }
    return str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
  };

  const toYaml = (obj: any, indent = 0): string => {
    if (obj === null || obj === undefined) {
      return String(obj);
    }
    if (typeof obj !== 'object') {
      return String(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => `\n${' '.repeat(indent)}- ${toYaml(item, indent + 2)}`).join('');
    }
    return Object.entries(obj)
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `${' '.repeat(indent)}${key}:${toYaml(value, indent + 2)}`;
        }
        return `${' '.repeat(indent)}${key}: ${toYaml(value, indent + 2)}`;
      })
      .join('\n');
  };

  const config = useConfig();
  const { value, loading, error } = useAsync(async (): Promise<Module> => {
    const { deployment } = props;

    const module_name = deployment?.module;
    const module_version = deployment?.module_version;
    const track = deployment?.module_track;

    const encodedModuleName = encodeURIComponent(module_name ?? '');
    const encodedModuleVersion = encodeURIComponent(module_version ?? '');

    // Using config.getApiUrl() instead of backendBaseUrl
    const response = await config.fetch(
      config.getApiUrl(
        `api/proxy/api/infraweave/api/v1/module/${track}/${encodedModuleName}/${encodedModuleVersion}`,
      ),
    );

    if (response.status >= 300 && response.status < 400) {
      throw new Error('Redirected to login or guest page');
    }

    const json = await response.json();
    return json;
  }, []);

  if (loading) {
    return <Progress />;
  } else if (error) {
    return <ResponseErrorPanel error={error} />;
  }

  return (
    <Box display="flex" flexDirection="column">
      <Box>
        <InfoCard
          title={
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <span>Deployment Inputs</span>
              <Chip
                icon={formatMode === 'yaml' ? <CodeIcon /> : <DataObjectIcon />}
                label={formatMode === 'yaml' ? 'YAML' : 'JSON'}
                size="small"
                onClick={() => setFormatMode((prev) => (prev === 'yaml' ? 'json' : 'yaml'))}
                sx={{ cursor: 'pointer' }}
              />
            </Box>
          }
        >
          <Box display="flex" flexDirection="column" gap={1}>
            {(value?.tf_variables ?? []).map((tf_variable) => {
              const actualValue =
                props.deployment?.variables?.[tf_variable.name] ?? tf_variable.default;
              const usesDefault = props.deployment?.variables?.[tf_variable.name] === undefined;

              if (actualValue === undefined) {
                return <>Variable error </>;
              }

              const displayName =
                tf_variable.name.split('__').length > 1
                  ? (() => {
                      const [claim, property] = tf_variable.name.split('__');
                      return `${claim}: ${snakeToCamelCase(property)}`;
                    })()
                  : snakeToCamelCase(tf_variable.name);

              const valueDisplayYaml =
                typeof actualValue === 'object' ? toYaml(actualValue) : String(actualValue);

              const valueDisplayJson =
                typeof actualValue === 'object'
                  ? JSON.stringify(actualValue, null, 2)
                  : String(actualValue);

              const valueDisplay = formatMode === 'yaml' ? valueDisplayYaml : valueDisplayJson;

              // For compact view, show in selected format
              const compactValueYaml =
                typeof actualValue === 'object' ? toYaml(actualValue) : String(actualValue);

              const compactValueJson =
                typeof actualValue === 'object' ? JSON.stringify(actualValue) : String(actualValue);

              const compactValue = formatMode === 'yaml' ? compactValueYaml : compactValueJson;

              return (
                <Tooltip
                  key={tf_variable.name}
                  title={
                    <Box sx={{ p: 1 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        {displayName}
                      </Typography>
                      <Typography variant="caption" display="block" sx={{ mb: 1, opacity: 0.9 }}>
                        {tf_variable.description || 'No description provided'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                        <Chip
                          label={tf_variable.type}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            bgcolor: 'success.light',
                            color: 'success.contrastText',
                          }}
                        />
                        {tf_variable.default == null && !tf_variable.nullable && (
                          <Chip
                            label="Required"
                            size="small"
                            color="primary"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                        {!usesDefault && (
                          <Chip
                            label="Explicitly set"
                            size="small"
                            color="info"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                        {usesDefault && tf_variable.default != null && (
                          <Chip
                            label="Using default"
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              bgcolor: 'grey.300',
                              color: 'grey.800',
                            }}
                          />
                        )}
                      </Box>
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{ fontWeight: 600, mb: 0.5 }}
                      >
                        Value:
                      </Typography>
                      <Box
                        sx={{
                          p: 1,
                          backgroundColor: 'rgba(0, 0, 0, 0.1)',
                          borderRadius: 1,
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          maxWidth: 400,
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {valueDisplay}
                      </Box>
                    </Box>
                  }
                  placement="right"
                  arrow
                  enterDelay={300}
                >
                  <Card
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      boxShadow: 0,
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      '&:hover': {
                        boxShadow: 2,
                        borderColor: 'primary.main',
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 2,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            minWidth: 0,
                            flex: '0 0 auto',
                            maxWidth: '30%',
                          }}
                          noWrap
                        >
                          {displayName}
                        </Typography>
                        <Typography
                          variant="body2"
                          component="pre"
                          sx={{
                            fontFamily: 'monospace',
                            color: 'text.secondary',
                            minWidth: 0,
                            flex: 1,
                            textAlign: 'left',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            m: 0,
                            display: 'flex',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <span
                            style={{
                              backgroundColor: 'rgba(33, 150, 243, 0.08)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              display: 'inline-block',
                            }}
                          >
                            {compactValue}
                          </span>
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(valueDisplay);
                          }}
                          sx={{ p: 0.5, alignSelf: 'flex-start' }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Tooltip>
              );
            })}
          </Box>
        </InfoCard>
      </Box>

      <Box marginTop={3}>
        <InfoCard
          title={
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <span>Deployment Outputs</span>
              <Chip
                icon={formatMode === 'yaml' ? <CodeIcon /> : <DataObjectIcon />}
                label={formatMode === 'yaml' ? 'YAML' : 'JSON'}
                size="small"
                onClick={() => setFormatMode((prev) => (prev === 'yaml' ? 'json' : 'yaml'))}
                sx={{ cursor: 'pointer' }}
              />
            </Box>
          }
        >
          <Box display="flex" flexDirection="column" gap={1}>
            {props.deployment?.output && props.deployment.status === 'successful' ? (
              Object.entries(props.deployment.output).map(([key, value]) => {
                const displayName =
                  key.split('__').length > 1
                    ? (() => {
                        const [claim, property] = key.split('__');
                        return `${claim}: ${snakeToCamelCase(property)}`;
                      })()
                    : snakeToCamelCase(key);

                const valueDisplayYaml =
                  typeof value.value === 'object'
                    ? toYaml(value.value)
                    : String(value.value || 'Not available');

                const valueDisplayJson =
                  typeof value.value === 'object'
                    ? JSON.stringify(value.value, null, 2)
                    : String(value.value || 'Not available');

                const valueDisplay = formatMode === 'yaml' ? valueDisplayYaml : valueDisplayJson;

                // For compact view, show in selected format
                const compactValueYaml =
                  typeof value.value === 'object'
                    ? toYaml(value.value)
                    : String(value.value || 'Not available');

                const compactValueJson =
                  typeof value.value === 'object'
                    ? JSON.stringify(value.value)
                    : String(value.value || 'Not available');

                const compactValue = formatMode === 'yaml' ? compactValueYaml : compactValueJson;

                return (
                  <Tooltip
                    key={key}
                    title={
                      <Box sx={{ p: 1 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                          {displayName}
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ mb: 1, opacity: 0.9 }}>
                          {value.description || 'No description provided'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                          {typeof value.value !== 'undefined' && (
                            <Chip
                              label={
                                typeof value.value === 'object' ? 'object' : typeof value.value
                              }
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                bgcolor: 'success.light',
                                color: 'success.contrastText',
                              }}
                            />
                          )}
                        </Box>
                        <Typography
                          variant="caption"
                          display="block"
                          sx={{ fontWeight: 600, mb: 0.5 }}
                        >
                          Value:
                        </Typography>
                        <Box
                          sx={{
                            p: 1,
                            backgroundColor: 'rgba(0, 0, 0, 0.1)',
                            borderRadius: 1,
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            maxWidth: 400,
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {valueDisplay}
                        </Box>
                      </Box>
                    }
                    placement="right"
                    arrow
                    enterDelay={300}
                  >
                    <Card
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        boxShadow: 0,
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        '&:hover': {
                          boxShadow: 2,
                          borderColor: 'primary.main',
                          backgroundColor: 'action.hover',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 2,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              minWidth: 0,
                              flex: '0 0 auto',
                              maxWidth: '30%',
                            }}
                            noWrap
                          >
                            {displayName}
                          </Typography>
                          <Typography
                            variant="body2"
                            component="pre"
                            sx={{
                              fontFamily: 'monospace',
                              color: 'text.secondary',
                              minWidth: 0,
                              flex: 1,
                              textAlign: 'left',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              m: 0,
                              display: 'flex',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <span
                              style={{
                                backgroundColor: 'rgba(33, 150, 243, 0.08)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                display: 'inline-block',
                              }}
                            >
                              {compactValue}
                            </span>
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(valueDisplay);
                            }}
                            sx={{ p: 0.5, alignSelf: 'flex-start' }}
                          >
                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </CardContent>
                    </Card>
                  </Tooltip>
                );
              })
            ) : (
              <Typography variant="body2" color="text.secondary">
                No outputs available. Ensure the deployment is successful to see the outputs.
              </Typography>
            )}
          </Box>
        </InfoCard>
      </Box>
    </Box>
  );
};
