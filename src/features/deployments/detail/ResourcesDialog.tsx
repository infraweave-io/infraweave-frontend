import React, { useMemo, useState } from 'react';
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import Close from '@mui/icons-material/Close';
import { SearchField } from '../../../shared/components/SearchField';

interface ResourcesDialogProps {
  open: boolean;
  onClose: () => void;
  resources: string[];
}

export const ResourcesDialog: React.FC<ResourcesDialogProps> = ({ open, onClose, resources }) => {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const sorted = [...resources].sort((a, b) => a.localeCompare(b));
    const query = filter.trim().toLowerCase();
    return query ? sorted.filter((r) => r.toLowerCase().includes(query)) : sorted;
  }, [resources, filter]);

  const handleClose = () => {
    onClose();
    setFilter('');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Resources</Typography>
          <IconButton onClick={handleClose} size="small" aria-label="Close">
            <Close />
          </IconButton>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {filter.trim()
            ? `${filtered.length} of ${resources.length} resources`
            : `${resources.length} resources`}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <SearchField
          autoFocus
          value={filter}
          onChange={setFilter}
          placeholder="Filter resources"
          sx={{ mb: 1.5, width: '100%' }}
        />
        {filtered.length > 0 ? (
          <Box
            component="ul"
            sx={{
              m: 0,
              p: 0,
              listStyle: 'none',
              maxHeight: '60vh',
              overflow: 'auto',
              bgcolor: 'background.default',
              borderRadius: 1,
            }}
          >
            {filtered.map((resource) => (
              <Box
                component="li"
                key={resource}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  wordBreak: 'break-all',
                  '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' },
                }}
              >
                {resource}
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No resources match the filter.
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};
