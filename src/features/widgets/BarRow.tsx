import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Tooltip, Typography } from '@mui/material';

type BarRowProps = {
  name: string;
  /** Muted text after the name, e.g. `stack`. */
  note?: string;
  to: string;
  /** Read in place of the row's text, which is split across name, bar and value. */
  ariaLabel: string;
  tooltip: string;
  /** Bar length relative to the longest bar, from 0 to 1. */
  fraction: number;
  /** A theme path such as `primary.main`, or a colour. */
  color: string;
  value: React.ReactNode;
};

/** One row of a ranked bar chart: name, bar, value. Render it inside an `<li>`. */
export const BarRow = ({
  name,
  note,
  to,
  ariaLabel,
  tooltip,
  fraction,
  color,
  value,
}: BarRowProps) => (
  <Tooltip placement="top" arrow title={tooltip}>
    {/* The whole row is the link and the hover target, not just the thin bar. */}
    <Box
      component={RouterLink}
      to={to}
      aria-label={ariaLabel}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr) auto',
        alignItems: 'center',
        gap: 1.5,
        py: 0.75,
        px: 0.5,
        mx: -0.5,
        borderRadius: 1,
        color: 'inherit',
        textDecoration: 'none',
        '&:hover, &:focus-visible': { bgcolor: 'action.hover' },
      }}
    >
      <Typography variant="body2" noWrap>
        <Box component="span" sx={{ color: 'primary.main' }}>
          {name}
        </Box>
        {note && (
          <Box component="span" sx={{ color: 'text.secondary' }}>
            {' '}
            · {note}
          </Box>
        )}
      </Typography>
      <Box
        sx={{
          height: 8,
          width: `${fraction * 100}%`,
          bgcolor: color,
          // Squared at the baseline, rounded at the data end.
          borderRadius: '0 4px 4px 0',
        }}
      />
      <Typography
        variant="body2"
        color="text.secondary"
        noWrap
        sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: 24 }}
      >
        {value}
      </Typography>
    </Box>
  </Tooltip>
);
