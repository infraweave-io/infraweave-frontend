import React, { useState } from 'react';
import { Popover, Typography, Card, CardContent, Box } from '@mui/material';
import { MarkdownContent } from '../../../standalone/components/ComponentAdapter';
import { TfVariable } from '../../../types/Module';

interface ModuleVariablePopoverProps {
  children: React.ReactNode;
  variable: TfVariable;
}

const ModuleVariablePopover: React.FC<ModuleVariablePopoverProps> = ({ children, variable }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [open, setOpen] = useState(false);

  const handlePopoverToggle = (event: React.MouseEvent<HTMLElement>) => {
    if (anchorEl) {
      setAnchorEl(null);
      setOpen(false);
    } else {
      setAnchorEl(event.currentTarget);
      setOpen(true);
    }
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
    setOpen(false);
  };

  const id = open ? 'simple-popover' : undefined;

  return (
    <div>
      <div onClick={handlePopoverToggle}>{children}</div>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'center',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'center',
          horizontal: 'center',
        }}
        disableScrollLock
        disableRestoreFocus
        slotProps={{
          root: {
            sx: {
              overflowY: 'scroll',
            },
          },
        }}
      >
        <Card>
          <CardContent>
            <Box mb={2} />
            <Box mb={2} />
            <Typography variant="h6">
              <Box display="flex" alignItems="center">
                Type:
                <Box mr={2} />
                <span style={{ color: 'navy' }}>{variable.type}</span>
              </Box>
            </Typography>
            <Box mb={2} />
            <Typography variant="h6">
              <Box display="flex" alignItems="center">
                Description:
              </Box>
            </Typography>
            <Box mb={2} />
            <MarkdownContent content={variable.description || '<No description>'} />
          </CardContent>
        </Card>
      </Popover>
    </div>
  );
};

export default ModuleVariablePopover;
