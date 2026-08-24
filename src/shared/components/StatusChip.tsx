import React from 'react';
import { Box, Chip, useTheme, alpha } from '@mui/material';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

export interface StatusChipProps {
  tone: StatusTone;
  label: string;
  title?: string;
  onClick?: () => void;
}

/**
 * Soft-tinted status pill with a leading dot.
 *
 * Saturated fills with white text (the previous `backgroundColor: 'purple'`
 * style) shout at the reader and make every row compete for attention; a tinted
 * background carries the same signal at a glance without dominating the table.
 */
export const StatusChip: React.FC<StatusChipProps> = ({ tone, label, title, onClick }) => {
  const theme = useTheme();
  const color = tone === 'neutral' ? theme.palette.text.secondary : theme.palette[tone].main;

  return (
    <Chip
      label={label}
      title={title}
      onClick={onClick}
      size="small"
      icon={
        <Box
          component="span"
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: color,
            flexShrink: 0,
            ml: '8px !important',
            mr: '-2px !important',
          }}
        />
      }
      sx={{
        color,
        bgcolor: alpha(color, theme.palette.mode === 'light' ? 0.1 : 0.18),
        border: '1px solid',
        borderColor: alpha(color, 0.22),
        fontWeight: 500,
        whiteSpace: 'nowrap',
        ...(onClick && {
          cursor: 'pointer',
          '&:hover': { bgcolor: alpha(color, theme.palette.mode === 'light' ? 0.16 : 0.26) },
        }),
      }}
    />
  );
};
