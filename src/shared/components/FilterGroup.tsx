import React from 'react';
import { Box, Typography, FormGroup } from '@mui/material';

export interface FilterGroupProps {
  label: string;
  children: React.ReactNode;
}

/**
 * One labelled block of filter controls.
 *
 * Groups render as sections inside a single bordered panel (see FilterPanel)
 * rather than as one card each -- a column of separate cards reads as three
 * unrelated widgets instead of one filter control.
 */
export const FilterGroup: React.FC<FilterGroupProps> = ({ label, children }) => (
  <Box
    component="section"
    sx={{
      px: 1.75,
      py: 1.5,
      '&:not(:first-of-type)': { borderTop: '1px solid', borderColor: 'divider' },
    }}
  >
    <Typography variant="overline" component="h2" color="text.secondary" sx={{ display: 'block' }}>
      {label}
    </Typography>
    <FormGroup sx={{ mt: 0.5, '& .MuiFormControlLabel-root': { ml: -0.75, mr: 0 } }}>
      {children}
    </FormGroup>
  </Box>
);

export interface FilterPanelProps {
  children: React.ReactNode;
}

/** Bordered container that holds a stack of FilterGroups. */
export const FilterPanel: React.FC<FilterPanelProps> = ({ children }) => (
  <Box
    sx={{
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 2,
      bgcolor: 'background.paper',
      overflow: 'hidden',
    }}
  >
    {children}
  </Box>
);
