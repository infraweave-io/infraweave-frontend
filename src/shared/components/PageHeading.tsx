import React from 'react';
import { Box, Typography } from '@mui/material';

export interface PageHeadingProps {
  title: string;
  /** One-line statement of what the page lists. */
  description?: string;
  /** Secondary explanation, shown smaller beneath the description. */
  detail?: string;
  /** Actions aligned to the right of the title, e.g. a refresh or create button. */
  actions?: React.ReactNode;
}

/**
 * Standard page title block.
 *
 * List pages used to lead with a full card whose only content was a sentence of
 * description, which pushed the actual data below the fold. A rule-separated
 * heading carries the same information in a fraction of the height.
 */
export const PageHeading: React.FC<PageHeadingProps> = ({
  title,
  description,
  detail,
  actions,
}) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 2,
      flexWrap: 'wrap',
      pb: 2,
      mb: 2.5,
      borderBottom: '1px solid',
      borderColor: 'divider',
    }}
  >
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="h2" component="h1">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: '84ch' }}>
          {description}
        </Typography>
      )}
      {detail && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, maxWidth: '84ch', display: 'block' }}
        >
          {detail}
        </Typography>
      )}
    </Box>
    {actions && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>{actions}</Box>
    )}
  </Box>
);
