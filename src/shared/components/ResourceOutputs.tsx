import React from 'react';
import { Card, CardContent, Typography, Box, Chip, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { MarkdownContent } from '../../standalone/components/ComponentAdapter';
import { formatVariableName, getCopyText } from './ResourceInputs';

export interface ResourceOutputsProps {
  outputs?: any[];
  view: string;
  resourceType: 'module' | 'stack';
}

export const ResourceOutputs: React.FC<ResourceOutputsProps> = ({
  outputs,
  view,
  resourceType,
}) => {
  const title = resourceType === 'module' ? 'Module Outputs' : 'Stack Outputs';

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {outputs?.length ? (
        <Box display="flex" flexDirection="column" gap={1}>
          {outputs.map((tf_variable) => {
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
                      {tf_variable.type && (
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
                    <Box sx={{ fontSize: '0.75rem' }}>
                      <MarkdownContent content={tf_variable.description || '<No description>'} />
                    </Box>
                    {resourceType === 'stack' && (
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{ mt: 1, opacity: 0.85, fontStyle: 'italic' }}
                      >
                        Output value available after deployment.
                      </Typography>
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
                          maxWidth: '50%',
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
                      {tf_variable.type && (
                        <Chip
                          label={tf_variable.type}
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem', flexShrink: 0 }}
                        />
                      )}
                      {tf_variable.sensitive && (
                        <Chip
                          label="Sensitive"
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem', flexShrink: 0 }}
                        />
                      )}
                      <Box sx={{ flex: 1 }} />
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(
                            getCopyText(tf_variable.name, resourceType, view),
                          );
                        }}
                        sx={{ p: 0.5, flexShrink: 0 }}
                        aria-label="Copy output name"
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
          No outputs available for this {resourceType}.
        </Typography>
      )}
    </Box>
  );
};
