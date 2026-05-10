import React from 'react';
import { Link, InfoCard } from '../../../standalone/components/ComponentAdapter';
import { Box, Grid, Typography } from '@mui/material';

export const Overview = () => (
  <Grid container>
    <Grid container>
      <Grid size={12} />
    </Grid>
    <Grid>
      <InfoCard title="Announcements" subheader="Latest news and updates">
        {/* <Card style={{ marginTop: 10 }}>
          <Box p={1}>
            <Typography variant="subtitle1">InfraWeave is now available</Typography>
            <Box mt={1} />
            <Typography variant="body2">
              Example: InfraWeave is now available for all users. You can now use InfraWeave to manage your infrastructure.
            </Typography>
          </Box>
        </Card>
        <Card style={{ marginTop: 10 }}>
          <Box p={1}>
            <Typography variant="subtitle1">Upcoming upgrade</Typography>
            <Box mt={1} />
            <Typography variant="body2">
              Example: We will be upgrading InfraWeave to version 0.1.0. The upgrade will take place on 12th December, no downtime is expected.
              <br />
              <br />
              Please ensure that you have saved your work before the upgrade.
            </Typography>
          </Box>
        </Card> */}
        <Box style={{ marginTop: 20 }}>
          <Typography variant="body2" style={{ padding: 0 }}>
            <Link to="/infraweave/announcements">View all announcements</Link>
          </Typography>
        </Box>
      </InfoCard>
    </Grid>
  </Grid>
);
