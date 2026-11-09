import React, { useState, useEffect } from 'react';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';

interface BadgeProps {
  value?: string;
  showPrefix?: boolean;
  // Show the full value instead of only the last path segment
  showFull?: boolean;
}

const CopyableChip = ({
  label,
  value,
  color,
  fullWidth = false,
}: {
  label: React.ReactNode;
  value: string;
  color: 'primary' | 'secondary';
  fullWidth?: boolean;
}) => {
  const [tooltip, setTooltip] = useState(value);

  useEffect(() => {
    setTooltip(value);
  }, [value]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setTooltip('Copied!');
  };

  const handleClose = () => {
    // Reset after a short delay to ensure it's closed visually before text changes back
    setTimeout(() => setTooltip(value), 200);
  };

  return (
    <Tooltip title={tooltip} onClose={handleClose}>
      <Chip
        label={label}
        size="small"
        variant="outlined"
        color={color}
        onClick={handleCopy}
        sx={{
          maxWidth: fullWidth ? '100%' : '250px',
          fontFamily: 'monospace',
          cursor: 'pointer',
        }}
      />
    </Tooltip>
  );
};

export const DeploymentIdBadge = ({ value, showPrefix = false, showFull = false }: BadgeProps) => {
  if (!value) return null;
  const displayValue = showFull ? value : value.split('/').pop() || value;

  const label = showPrefix ? (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
      <Box component="span" sx={{ opacity: 0.7, mr: 0.5, fontWeight: 400 }}>
        Depl.id:
      </Box>
      <Box component="span" sx={{ fontWeight: 600 }}>
        {displayValue}
      </Box>
    </Box>
  ) : (
    displayValue
  );

  return <CopyableChip label={label} value={value} color="secondary" fullWidth={showFull} />;
};

export const EnvironmentBadge = ({ value, showPrefix = false, showFull = false }: BadgeProps) => {
  if (!value) return null;
  const displayValue = showFull ? value : value.split('/').pop() || value;

  const label = showPrefix ? (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
      <Box component="span" sx={{ opacity: 0.7, mr: 0.5, fontWeight: 400 }}>
        Env.id:
      </Box>
      <Box component="span" sx={{ fontWeight: 600 }}>
        {displayValue}
      </Box>
    </Box>
  ) : (
    displayValue
  );

  return <CopyableChip label={label} value={value} color="primary" fullWidth={showFull} />;
};
