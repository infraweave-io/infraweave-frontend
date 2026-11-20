import React from 'react';
import { Box, LinearProgress, Paper, Tooltip, Typography } from '@mui/material';
import { StatusKind, statusKind } from '../../../utils/deploymentStatus';
import { StatusTone } from '../../../shared/components/StatusChip';

/** Max height in px before a table scrolls instead of growing the page. */
export const TABLE_MAX_HEIGHT = 420;

export const countTone = (count: number, tone: StatusTone): StatusTone =>
  count > 0 ? tone : 'neutral';

const STATUS_TONE: Record<StatusKind, StatusTone> = {
  success: 'success',
  failed: 'error',
  running: 'info',
  unknown: 'neutral',
};

export const statusTone = (status: string): StatusTone => STATUS_TONE[statusKind(status)];

export const formatLastActivity = (epoch: number): string =>
  epoch > 0 ? new Date(epoch).toLocaleDateString() : '-';

export const Metric = ({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: number | string;
  tone?: StatusTone;
  hint?: string;
}) => (
  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
      {label}
    </Typography>
    <Tooltip title={hint ?? ''} disableHoverListener={!hint}>
      <Typography
        variant="h4"
        sx={{ fontWeight: 600, color: tone === 'neutral' ? 'text.primary' : `${tone}.main` }}
      >
        {value}
      </Typography>
    </Tooltip>
  </Paper>
);

export const CountBar = ({ count, max, label }: { count: number; max: number; label: string }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
    <LinearProgress
      variant="determinate"
      value={max > 0 ? (count / max) * 100 : 0}
      aria-label={label}
      sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
    />
    <Typography
      variant="body2"
      color={count > 0 ? 'text.primary' : 'text.secondary'}
      sx={{ minWidth: 32, textAlign: 'right' }}
    >
      {count}
    </Typography>
  </Box>
);

/** Waits a frame so the state change that fills the section has rendered first. */
export const scrollToSection = (ref: React.RefObject<HTMLElement | null>) =>
  requestAnimationFrame(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  });
