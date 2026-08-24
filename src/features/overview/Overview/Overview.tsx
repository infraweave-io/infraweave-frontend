import React from 'react';
import { Link, InfoCard } from '../../../standalone/components/ComponentAdapter';
import { Box, Grid, Typography } from '@mui/material';

/**
 * Landing content for the Overview tab.
 *
 * Cards are sized to their content and laid out on a responsive grid; the
 * previous full-width card stretched a single link across the viewport.
 */
export const Overview = () => (
  <Grid container spacing={2.5}>
    <Grid size={{ xs: 12, md: 6, lg: 4 }}>
      <InfoCard
        title="Announcements"
        subheader="Latest news and updates"
        deepLink={{ link: '/infraweave/announcements', title: 'View all announcements' }}
      >
        <Typography variant="body2" color="text.secondary">
          No announcements right now.
        </Typography>
      </InfoCard>
    </Grid>
    <Grid size={{ xs: 12, md: 6, lg: 4 }}>
      <InfoCard title="About InfraWeave" subheader="Documentation and guides">
        <Typography variant="body2" color="text.secondary">
          InfraWeave manages modules, stacks, and deployments across your cloud accounts.
        </Typography>
        <Box sx={{ mt: 1.5 }}>
          <Link href="https://preview.infraweave.io/">Read the documentation</Link>
        </Box>
      </InfoCard>
    </Grid>
  </Grid>
);
