import React, { useState } from 'react';
import { ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { Box, Button, Card, CardContent, CardHeader, Grid, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DeploymentsDialog } from '../../modules/detail/ModuleVersions';
import { isStackDeployment, moduleName, useFleetDeployments } from './useFleetDeployments';
import { scrollToSection } from './OverviewParts';
import {
  ContextFilters,
  matchesFilters,
  usageHref,
  useScrollToOpenedSelection,
  useUsageContext,
} from './usageContext';
import type { UsageKind, UsageContext } from './usageContext';
import { FleetGate } from './FleetStatus';
import { UsageRanking } from './UsageRanking';
import { UsageOverviewCard } from './UsageOverviewCard';
import { VersionDistributionCard } from './VersionDistributionCard';
const useUsageViewData = (
  fleet: ReturnType<typeof useFleetDeployments>,
  kind: UsageKind,
  filters: Pick<UsageContext, 'region' | 'account'>,
  selectedName: string,
) => {
  const catalogue = kind === 'stack' ? fleet.stackCatalogue : fleet.moduleCatalogue;
  const registered = React.useMemo(() => catalogue.map(moduleName).filter(Boolean), [catalogue]);
  const stackNames = React.useMemo(
    () => new Set(fleet.stackCatalogue.map(moduleName)),
    [fleet.stackCatalogue],
  );
  const kindDeployments = React.useMemo(
    () =>
      fleet.deployments.filter(
        (deployment) =>
          isStackDeployment(deployment, stackNames) === (kind === 'stack') &&
          matchesFilters(deployment, filters),
      ),
    [fleet.deployments, stackNames, kind, filters],
  );
  // Include registry entries, deployed names missing from the registry, and URL deep links.
  const options = React.useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...registered,
            ...kindDeployments.map((deployment) => deployment.module),
            selectedName,
          ].filter(Boolean),
        ),
      ).sort(),
    [registered, kindDeployments, selectedName],
  );
  const selectedDeployments = React.useMemo(
    () =>
      selectedName
        ? kindDeployments.filter((deployment) => deployment.module === selectedName)
        : [],
    [kindDeployments, selectedName],
  );

  return { registered, kindDeployments, options, selectedDeployments };
};

export const UsageView = ({ kind, onBack }: { kind: UsageKind; onBack: () => void }) => {
  const fleet = useFleetDeployments();
  const { projectNames } = fleet;
  // Selection and filters live in the URL so other pages can deep-link to a drill-down.
  const { context, set } = useUsageContext();
  const selectedName = context.module ?? '';
  const setSelectedName = (name: string) => set('module', name || undefined);
  const filters = React.useMemo(
    () => ({ region: context.region, account: context.account }),
    [context.region, context.account],
  );
  const overviewRef = React.useRef<HTMLDivElement>(null);
  const [openDeployments, setOpenDeployments] = useState(false);
  const [selectedVersionForModal, setSelectedVersionForModal] = useState('');
  const { registered, kindDeployments, options, selectedDeployments } = useUsageViewData(
    fleet,
    kind,
    filters,
    selectedName,
  );

  const handleVersionClick = (version: string) => {
    setSelectedVersionForModal(version);
    setOpenDeployments(true);
  };
  const selectFromRanking = (name: string) => {
    setSelectedName(name);
    scrollToSection(overviewRef);
  };
  useScrollToOpenedSelection(selectedName, fleet.fetchedAt > 0 && fleet.accessKnown, () =>
    scrollToSection(overviewRef),
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
        <FleetGate
          fleet={fleet}
          scope={{ deployments: kindDeployments, noun: `${kind} deployment` }}
        >
          <ContextFilters
            filters={filters}
            projectNames={projectNames}
            onClear={(key) => set(key, undefined)}
          />
          <Card variant="outlined" sx={{ width: '100%', mb: 3 }}>
            <CardHeader
              title={`Most deployed ${kind}s`}
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            />
            <CardContent>
              <Typography variant="body1" paragraph>
                Every {kind} in the registry, by number of active deployments. Select one to see
                where it runs and on which versions.
              </Typography>
              <UsageRanking
                kind={kind}
                deployments={kindDeployments}
                registered={registered}
                loading={fleet.loadingCatalog}
                selected={selectedName}
                onSelect={selectFromRanking}
              />
            </CardContent>
          </Card>

          <UsageOverviewCard
            kind={kind}
            selectedName={selectedName}
            options={options}
            deployments={selectedDeployments}
            projectNames={projectNames}
            filters={filters}
            overviewRef={overviewRef}
            onSelectName={setSelectedName}
            onVersionClick={handleVersionClick}
            accountHref={(projectId) =>
              usageHref('account-usage', {
                account: projectId,
                module: selectedName,
                kind,
                region: filters.region,
              })
            }
          />

          {selectedName && (
            <VersionDistributionCard
              key={selectedName}
              kind={kind}
              deployments={selectedDeployments}
              onVersionClick={handleVersionClick}
            />
          )}

          {/* The dialog is shared by version links from both cards. */}
          {openDeployments && selectedName && (
            <DeploymentsDialog
              open={openDeployments}
              onClose={() => setOpenDeployments(false)}
              moduleName={selectedName}
              version={selectedVersionForModal}
              resourceType={kind}
              initialProjectIds={filters.account ? [filters.account] : undefined}
              initialRegions={filters.region ? [filters.region] : undefined}
            />
          )}
        </FleetGate>
      </Grid>
    </Grid>
  );
};
