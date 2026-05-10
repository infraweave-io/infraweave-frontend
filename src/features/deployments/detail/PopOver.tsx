import React, { useState } from 'react';
import { Popover, Typography, Card, CardContent } from '@mui/material';
import { PolicyResult } from '../../../types/Deployment';
import {
  CodeSnippet,
  MarkdownContent,
  Link,
} from '../../../standalone/components/ComponentAdapter';
import { StatusError, StatusOK } from '../../../standalone/components/ComponentAdapter';
import { Box } from '@mui/material';

interface PopoverExampleProps {
  children: React.ReactNode;
  policyResult: PolicyResult;
}

export const PopoverExample: React.FC<PopoverExampleProps> = ({ children, policyResult }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);

  const handlePopoverToggle = (event: React.MouseEvent<HTMLDivElement>): void => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popover' : undefined;

  return (
    <div>
      <div onClick={handlePopoverToggle}>{children}</div>

      <Popover
        id={id}
        slotProps={{
          root: {
            sx: {
              overflowY: 'scroll',
            },
          },
        }}
        open={open}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        disableScrollLock
        disableRestoreFocus
      >
        <Card>
          <CardContent>
            <Typography variant="h6">
              Policy:{' '}
              <Link
                to={`/infraweave/policy/${encodeURIComponent(
                  policyResult.environment,
                )}/${encodeURIComponent(policyResult.policy)}/${encodeURIComponent(
                  policyResult.version,
                )}`}
              >
                <i>{policyResult.policy}</i> ({policyResult.version})
              </Link>
            </Typography>
            <Box mb={2} />
            <Typography variant="body2">
              <Box display="flex" alignItems="center">
                Results: {policyResult.failed ? <StatusError /> : <StatusOK />}
              </Box>
            </Typography>
            {policyResult.failed && (
              <>
                <Typography variant="body2">Violations: </Typography>
                <CodeSnippet
                  language="json"
                  showCopyCodeButton
                  text={
                    JSON.stringify(policyResult.violations, null, 2) // If actual value is an object, format it nicely
                  }
                />
              </>
            )}
            <Typography variant="body2">Description:</Typography>
            <Box mb={2} />
            <Card>
              <CardContent>
                <MarkdownContent content={policyResult.description || '<No description>'} />
              </CardContent>
            </Card>
            <Box mb={2} />
          </CardContent>
        </Card>
      </Popover>
    </div>
  );
};

export default PopoverExample;
