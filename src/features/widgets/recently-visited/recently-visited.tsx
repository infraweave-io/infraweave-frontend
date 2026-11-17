import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import TabIcon from '@mui/icons-material/Tab';
import DeploymentIcon from '@mui/icons-material/Rocket';
import StackIcon from '@mui/icons-material/Layers';
import ModuleIcon from '@mui/icons-material/Extension';
import PolicyIcon from '@mui/icons-material/Policy';
import ProviderIcon from '@mui/icons-material/Cloud';
import { Link } from '../../../standalone/components/ComponentAdapter';
import { getVisits, subscribeToVisits, VisitKind } from '../../../utils/visitHistory';

const MAX_ROWS = 8;

/** The same icons as the navigation drawer, so a kind reads the same everywhere. */
const KIND_ICON: Record<VisitKind, React.ElementType> = {
  tab: TabIcon,
  deployment: DeploymentIcon,
  module: ModuleIcon,
  stack: StackIcon,
  policy: PolicyIcon,
  provider: ProviderIcon,
};

const ago = (epoch: number): string => {
  const minutes = Math.max(0, Math.round((Date.now() - epoch) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

/** The pages this user opened most recently, newest first. */
export const RecentlyVisitedList = () => {
  const visits = React.useSyncExternalStore(subscribeToVisits, getVisits);
  const shown = visits.slice(0, MAX_ROWS);

  if (shown.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Pages you visit will show up here.
      </Typography>
    );
  }

  return (
    <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
      {shown.map((visit) => {
        const Icon = KIND_ICON[visit.kind];
        return (
          <Box
            key={visit.key}
            sx={{ py: 1, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}
          >
            <Icon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                <Link to={visit.path}>{visit.label}</Link>
              </Typography>
              {visit.detail && (
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {visit.detail}
                </Typography>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              {ago(visit.at)}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
};
