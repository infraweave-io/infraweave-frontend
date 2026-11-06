import React, { useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import { shortenVersion } from '../../utils/version';

export const VersionCell = ({ version }: { version: string }) => {
  const [copied, setCopied] = useState(false);

  const displayVersion = React.useMemo(() => shortenVersion(version), [version]);

  return (
    <Tooltip title={copied ? 'Copied!' : version} arrow placement="top">
      <Box
        component="span"
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(version);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        sx={{
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          borderRadius: 0.5,
          // The copy affordance shows on hover. Underlining every version at
          // rest turned the column into a block of ruled text.
          '&:hover': {
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
            textUnderlineOffset: '3px',
          },
        }}
      >
        {displayVersion}
      </Box>
    </Tooltip>
  );
};
