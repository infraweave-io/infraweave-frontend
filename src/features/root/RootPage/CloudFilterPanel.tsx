import React from 'react';
import { FormControlLabel, Checkbox } from '@mui/material';
import { FilterGroup } from '../../../shared/components/FilterGroup';
import { useSelectedProviders } from './SelectedProvidersContext';

const CloudFilterPanel = () => {
  const { selectedProviders, toggleProviderSelection, availableProviders } = useSelectedProviders();

  const handleCloudFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    toggleProviderSelection(event.target.name.toLowerCase()); // Normalize name to lowercase
  };

  return (
    <FilterGroup label="Cloud">
      {availableProviders.map((provider) => {
        const providerName = provider.toLowerCase(); // Normalize provider name to lowercase
        return (
          <FormControlLabel
            key={providerName}
            control={
              <Checkbox
                size="small"
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
    </FilterGroup>
  );
};

export default CloudFilterPanel;
