import React from 'react';
import { Box, Paper, Typography, FormControlLabel, Checkbox } from '@mui/material';
import { useSelectedProviders } from './SelectedProvidersContext';

const CloudFilterPanel = () => {
  const { selectedProviders, toggleProviderSelection, availableProviders } = useSelectedProviders();

  const handleCloudFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    toggleProviderSelection(event.target.name.toLowerCase()); // Normalize name to lowercase
  };

  return (
    <Paper elevation={1}>
      <Box p={2}>
        <Typography variant="h6">Cloud:</Typography>
        {availableProviders.map((provider) => {
          const providerName = provider.toLowerCase(); // Normalize provider name to lowercase
          return (
            <FormControlLabel
              key={providerName}
              control={
                <Checkbox
                  checked={selectedProviders.includes(providerName)}
                  onChange={handleCloudFilterChange}
                  name={providerName}
                  color="primary"
                />
              }
              label={provider}
            />
          );
        })}
      </Box>
    </Paper>
  );
};

export default CloudFilterPanel;
