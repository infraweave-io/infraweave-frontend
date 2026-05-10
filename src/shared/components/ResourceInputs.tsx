import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  ToggleButton,
  styled,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { MarkdownContent } from '../../standalone/components/ComponentAdapter';
import camelCase from 'camelcase';

export const CustomToggleButton = styled(ToggleButton)(({ theme }: { theme: Theme }) => ({
  '&.Mui-selected': {
    color: theme.palette.common.white,
    backgroundColor: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: theme.palette.primary.light,
    },
  },
}));

/**
 * Format variable name for display based on resource type and view
 * - For modules: just use camelCase
 * - For stacks: split on __ and format as "prefix:\n    propertyName:"
 */
export const formatVariableName = (
  name: string,
  resourceType: 'module' | 'stack',
  view: string,
): string | React.JSX.Element => {
  if (view === 'terraform' || view === 'python') {
    return name;
  }

  if (resourceType === 'module') {
    return camelCase(name);
  }

  const [prefix, propertyName] = name.split('__');
  if (!propertyName) {
    return camelCase(name);
  }

  const formattedProperty = propertyName.replace(/_([a-z])/g, (_match: any, letter: string) =>
    letter.toUpperCase(),
  );

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.5 }}>
      <Typography
        component="span"
        variant="caption"
        sx={{ color: 'text.secondary', fontWeight: 500 }}
      >
        {prefix}:
      </Typography>
      <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>
        {formattedProperty}
      </Typography>
    </Box>
  );
};

/**
 * Get the text to copy to clipboard for a variable name
 */
export const getCopyText = (
  name: string,
  resourceType: 'module' | 'stack',
  view: string,
): string => {
  if (view === 'terraform' || view === 'python') {
    return name;
  }

  if (resourceType === 'module') {
    return camelCase(name);
  }

  const [_prefix, propertyName] = name.split('__');
  if (!propertyName) {
    return camelCase(name);
  }

  return propertyName.replace(/_([a-z])/g, (_match: any, letter: string) => letter.toUpperCase());
};

const formatDefault = (def: any): string => {
  if (def === null || def === undefined) return '';
  return typeof def === 'object' ? JSON.stringify(def, null, 2) : String(def);
};

const formatDefaultCompact = (def: any): string => {
  if (def === null || def === undefined) return '';
  return typeof def === 'object' ? JSON.stringify(def) : String(def);
};

export interface ResourceInputsProps {
  inputs?: any[];
  view: string;
  resourceType: 'module' | 'stack';
}

export const ResourceInputs: React.FC<ResourceInputsProps> = ({ inputs, view, resourceType }) => {
  const orderedByRequired = inputs?.slice().sort((a, b) => {
    const aRequired = a.default == null && !a.nullable ? 0 : 1;
    const bRequired = b.default == null && !b.nullable ? 0 : 1;
    return aRequired - bRequired;
  });

  const title = resourceType === 'module' ? 'Module Inputs' : 'Stack Inputs';

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {orderedByRequired?.length ? (
        <Box display="flex" flexDirection="column" gap={1}>
          {orderedByRequired.map((tf_variable) => {
            const isRequired = tf_variable.default == null && !tf_variable.nullable;
            const hasDefault = tf_variable.default != null;
            const defaultDisplay = formatDefault(tf_variable.default);
            const defaultCompact = formatDefaultCompact(tf_variable.default);
            const formattedName = formatVariableName(tf_variable.name, resourceType, view);

            return (
              <Tooltip
                key={tf_variable.name}
                placement="top"
                arrow
                enterDelay={300}
                slotProps={{
                  tooltip: { sx: { maxWidth: 480 } },
                  popper: {
                    modifiers: [
                      {
                        name: 'flip',
                        enabled: true,
                        options: {
                          fallbackPlacements: ['bottom', 'left', 'right'],
                          padding: 8,
                        },
                      },
                      {
                        name: 'preventOverflow',
                        enabled: true,
                        options: { padding: 8, altAxis: true },
                      },
                    ],
                  },
                }}
                title={
                  <Box sx={{ p: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      {getCopyText(tf_variable.name, resourceType, view)}
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
                      {isRequired && (
                        <Chip
                          label="Required"
                          size="small"
                          color="error"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                      {tf_variable.nullable && (
                        <Chip
                          label="Nullable"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.7rem',
                            bgcolor: 'grey.300',
                            color: 'grey.800',
                          }}
                        />
                      )}
                      {tf_variable.sensitive && (
                        <Chip
                          label="Sensitive"
                          size="small"
                          color="warning"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" display="block" sx={{ fontWeight: 600, mb: 0.5 }}>
                      Description:
                    </Typography>
                    <Box sx={{ mb: hasDefault ? 1 : 0, fontSize: '0.75rem' }}>
                      <MarkdownContent content={tf_variable.description || '<No description>'} />
                    </Box>
                    {hasDefault && (
                      <>
                        <Typography
                          variant="caption"
                          display="block"
                          sx={{ fontWeight: 600, mb: 0.5 }}
                        >
                          Default:
                        </Typography>
                        <Box
                          sx={{
                            p: 1,
                            backgroundColor: 'rgba(0, 0, 0, 0.15)',
                            borderRadius: 1,
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            maxHeight: 200,
                            overflow: 'auto',
                          }}
                        >
                          {defaultDisplay}
                        </Box>
                      </>
                    )}
                  </Box>
                }
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
                  <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <Box
                        sx={{
                          minWidth: 0,
                          flex: '0 1 auto',
                          maxWidth: '40%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {typeof formattedName === 'string' ? (
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {formattedName}
                          </Typography>
                        ) : (
                          formattedName
                        )}
                      </Box>
                      <Chip
                        label={tf_variable.type}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem', flexShrink: 0 }}
                      />
                      {isRequired ? (
                        <Chip
                          label="Required"
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem', flexShrink: 0 }}
                        />
                      ) : (
                        hasDefault && (
                          <Typography
                            variant="body2"
                            component="span"
                            sx={{
                              fontFamily: 'monospace',
                              color: 'text.secondary',
                              fontSize: '0.75rem',
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              textAlign: 'right',
                            }}
                          >
                            <span
                              style={{
                                backgroundColor: 'rgba(33, 150, 243, 0.08)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {defaultCompact}
                            </span>
                          </Typography>
                        )
                      )}
                      {!isRequired && !hasDefault && <Box sx={{ flex: 1 }} />}
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(
                            getCopyText(tf_variable.name, resourceType, view),
                          );
                        }}
                        sx={{ p: 0.5, flexShrink: 0 }}
                        aria-label="Copy variable name"
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
      ) : (
        <Typography variant="body2" color="text.secondary">
          No inputs defined
        </Typography>
      )}
    </Box>
  );
};
