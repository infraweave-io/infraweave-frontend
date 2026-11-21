import React from 'react';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { Button } from '@mui/material';
import { PageHeading } from '../../../shared/components/PageHeading';
import { ModuleStackUsageExplorerCard } from './ModuleStackUsageExplorerCard';

export const ModuleStackUsageExplorerPage = ({ onBack }: { onBack: () => void }) => (
  <>
    <PageHeading
      title="Deployment Explorer"
      description="Explore detailed deployments of modules, standalone or contained in stacks. Filter by module, version, account, or region, and inspect deployment details."
      actions={
        <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
          Back to Dashboard
        </Button>
      }
    />
    <ModuleStackUsageExplorerCard />
  </>
);
