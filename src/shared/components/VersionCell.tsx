import React, { useState } from 'react';
import { Tooltip } from '@mui/material';

export const VersionCell = ({ version }: { version: string }) => {
  const [copied, setCopied] = useState(false);

  const displayVersion = React.useMemo(() => {
    if (!version) return '';
    if (version.length < 25) return version;

    // Check for build metadata separator '+'
    if (version.includes('+')) {
      const parts = version.split('+');
      const base = parts[0];
      const items = parts.slice(1).join('+'); // In case of specific multiple +, join rest
      if (items.length > 15) {
        return `${base}+${items.substring(0, 6)}...${items.substring(items.length - 8)}`;
      }
    }

    // Fallback basic shortening
    return `${version.substring(0, 10)}...${version.substring(version.length - 8)}`;
  }, [version]);

  return (
    <Tooltip title={copied ? 'Copied!' : version} arrow placement="top">
      <span
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(version);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        style={{
          cursor: 'pointer',
          textDecoration: 'underline',
          textDecorationStyle: 'dotted',
        }}
      >
        {displayVersion}
      </span>
    </Tooltip>
  );
};
