import React from 'react';
import type { ReactElement } from 'react';
import { alpha, Box, Card, CardActionArea, CardContent, Grid, Typography } from '@mui/material';
import AccountIcon from '@mui/icons-material/Folder';
import ModuleIcon from '@mui/icons-material/Extension';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import RegionIcon from '@mui/icons-material/Public';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import StackIcon from '@mui/icons-material/Layers';
import { PageHeading } from '../../../shared/components/PageHeading';

type DashboardView =
  | 'module-usage'
  | 'stack-usage'
  | 'region-usage'
  | 'account-usage'
  | 'health'
  | 'issues';
type DashboardCardData = {
  view: DashboardView;
  icon: ReactElement;
  tone: 'primary' | 'success' | 'warning';
  title: string;
  description: string;
};

const dashboardCards: DashboardCardData[] = [
  {
    view: 'module-usage',
    icon: <ModuleIcon />,
    tone: 'primary',
    title: 'Module Usage',
    description:
      'Which modules are deployed, where, and on which versions. Track adoption of new module versions.',
  },
  {
    view: 'stack-usage',
    icon: <StackIcon />,
    tone: 'primary',
    title: 'Stack Usage',
    description:
      'Which stacks are deployed, where, and on which versions. Track adoption of new stack versions.',
  },
  {
    view: 'region-usage',
    icon: <RegionIcon />,
    tone: 'primary',
    title: 'Region Usage',
    description:
      'How much runs in each region, and which modules, stacks and accounts are behind it.',
  },
  {
    view: 'account-usage',
    icon: <AccountIcon />,
    tone: 'primary',
    title: 'Account Usage',
    description:
      'What each account runs, on which versions and in which regions, and what is failing there.',
  },
  {
    view: 'health',
    icon: <MonitorHeartIcon />,
    tone: 'success',
    title: 'Deployment Health',
    description: 'Identify failed or drifting deployments. Find environments that need attention.',
  },
  {
    view: 'issues',
    icon: <ReportProblemIcon />,
    tone: 'warning',
    title: 'Module Issues',
    description:
      'View modules with the highest failure rates. Diagnose and resolve issues quickly.',
  },
];

const DashboardCard = ({
  icon,
  tone,
  title,
  description,
  onClick,
}: Omit<DashboardCardData, 'view'> & { onClick: () => void }) => (
  <Card sx={{ height: '100%' }}>
    <CardActionArea
      onClick={onClick}
      // Column flex keeps content top-aligned; buttons centre it vertically by default.
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            display: 'grid',
            placeItems: 'center',
            mb: 1.5,
            color: `${tone}.main`,
            bgcolor: (theme) => alpha(theme.palette[tone].main, 0.1),
            '& svg': { fontSize: '1.125rem' },
          }}
        >
          {icon}
        </Box>
        <Typography variant="h5" component="h2" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </CardActionArea>
  </Card>
);

export const AdoptionHealthDashboard = ({
  onNavigate,
}: {
  onNavigate: (view: DashboardView) => void;
}) => (
  <Box>
    <PageHeading
      title="Adoption & Health"
      description="Which module and stack versions are deployed where, and which deployments are failing."
    />
    <Grid container spacing={2.5}>
      {dashboardCards.map(({ view, ...card }) => (
        <Grid key={view} size={{ xs: 12, md: 6, lg: 4 }}>
          <DashboardCard {...card} onClick={() => onNavigate(view)} />
        </Grid>
      ))}
    </Grid>
  </Box>
);
