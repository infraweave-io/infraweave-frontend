import React from 'react';
import {
  FramedTableContainer,
  InfoCard,
  Link,
  ResponseErrorPanel,
} from '../../../standalone/components/ComponentAdapter';
import {
  Box,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { PieChart } from '@mui/x-charts/PieChart';
import { useChartStatusColors } from '../../../contexts/ThemeContext';
import type { Deployment } from '../../../types/Deployment';
import { isFailedDeployment, statusKind } from '../../../utils/deploymentStatus';
import { deploymentKey, deploymentLink } from './deploymentViewUtils';
import { FleetGate } from './FleetStatus';
import { useFleetDeployments } from './useFleetDeployments';

/** Deployments per value of one field, as pie slices, largest first. */
const countBy = (
  deployments: Deployment[],
  key: (d: Deployment) => string,
  label: (value: string) => string = (value) => value,
) => {
  const counts = new Map<string, number>();
  for (const deployment of deployments) {
    const id = key(deployment);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([id, value]) => ({ id, value, label: label(id) }))
    .sort((a, b) => b.value - a.value);
};

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const DeploymentHealthView = ({ onBack }: { onBack: () => void }) => {
  const fleet = useFleetDeployments();
  const chartColors = useChartStatusColors();

  // chartColors is a per-mode constant, so this only reruns on a theme flip or fleet reload.
  const statusStats = React.useMemo(
    () =>
      countBy(fleet.deployments, (d) => d.status || 'unknown', capitalise).map((slice) => ({
        ...slice,
        color: chartColors[statusKind(slice.id)],
      })),
    [fleet.deployments, chartColors],
  );

  const errorDeployments = React.useMemo(
    // Same rule as Module Issues, so the two views agree on how many are failing.
    () => fleet.deployments.filter(isFailedDeployment),
    [fleet.deployments],
  );

  if (fleet.error) return <ResponseErrorPanel error={fleet.error} />;

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Box mb={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
            Back to Dashboard
          </Button>
        </Box>
        <FleetGate fleet={fleet}>
          <Grid container spacing={3}>
            {/* Status Ratio */}
            <Grid size={{ xs: 12, md: 6 }}>
              <InfoCard title="Status Ratio">
                <Typography variant="body1" paragraph>
                  Overview of deployment statuses across all projects in the platform.
                </Typography>
                <Box sx={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center' }}>
                  <PieChart
                    series={[
                      {
                        data: statusStats,
                        innerRadius: 30,
                        outerRadius: 100,
                        paddingAngle: 5,
                        cornerRadius: 5,
                        highlightScope: { fade: 'global', highlight: 'item' },
                        faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
                      },
                    ]}
                    height={300}
                  />
                </Box>
              </InfoCard>
            </Grid>

            {/* Error Log */}
            <Grid size={12}>
              <InfoCard title={`Active Errors (${errorDeployments.length})`}>
                <Typography variant="body1" paragraph>
                  Detailed list of deployments currently active but in a failed state across all
                  projects.
                </Typography>
                {errorDeployments.length === 0 ? (
                  <Typography
                    variant="body1"
                    sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}
                  >
                    No deployments currently in failed state. Great job!
                  </Typography>
                ) : (
                  <FramedTableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Deployment ID</TableCell>
                          <TableCell>Environment</TableCell>
                          <TableCell>Region</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Error Info</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {errorDeployments.map((d) => (
                          <TableRow key={deploymentKey(d)}>
                            <TableCell sx={{ fontWeight: 'medium' }}>
                              <Link to={deploymentLink(d)}>{d.deployment_id}</Link>
                            </TableCell>
                            <TableCell>{d.environment}</TableCell>
                            <TableCell>{d.region}</TableCell>
                            <TableCell sx={{ color: 'error.main' }}>{d.status}</TableCell>
                            <TableCell>
                              <Typography variant="body2" color="error">
                                {d.error_text || 'Unknown failure reason'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </FramedTableContainer>
                )}
              </InfoCard>
            </Grid>
          </Grid>
        </FleetGate>
      </Grid>
    </Grid>
  );
};
