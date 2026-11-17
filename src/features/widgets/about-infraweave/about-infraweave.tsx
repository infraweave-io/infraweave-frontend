import React from 'react';
import { Box, Typography } from '@mui/material';
import { Link } from '../../../standalone/components/ComponentAdapter';

/** What InfraWeave is, with a way into the documentation. */
export const AboutInfraWeave = () => (
  <>
    <Typography variant="body2" color="text.secondary">
      InfraWeave manages modules, stacks, and deployments across your cloud accounts.
    </Typography>
    <Box sx={{ mt: 1.5 }}>
      <Link href="https://preview.infraweave.io/">Read the documentation</Link>
    </Box>
  </>
);
