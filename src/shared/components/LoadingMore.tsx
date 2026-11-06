import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

type LoadingMoreProps = {
  label?: string;
};

/**
 * Inline indicator for lists that keep loading pages while already showing rows,
 * so a partially filled table never looks like the complete result.
 */
export const LoadingMore = ({ label = 'Loading more…' }: LoadingMoreProps) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 2 }}>
    {/* Named, so it isn't announced as a bare unlabelled progressbar. */}
    <CircularProgress size={16} aria-label={label} />
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
  </Box>
);
