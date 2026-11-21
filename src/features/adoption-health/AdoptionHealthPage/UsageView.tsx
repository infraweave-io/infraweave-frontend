import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  LinearProgress,
  Typography,
} from '@mui/material';
import { ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import type { Deployment } from '../../../types/Deployment';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { DeploymentsDialog } from '../../modules/detail/ModuleVersions';
import { isStackDeployment, moduleName, useFleetDeployments } from './useFleetDeployments';
import { scrollToSection } from './OverviewParts';
import {
  ContextFilters,
  COUNT_NOUN,
  DEFAULT_MODULE_USAGE_MODE,
  MODULE_USAGE_MODE_LABEL,
  ModuleUsageSourceHelp,
  matchesFilters,
  usageHref,
  useScrollToOpenedSelection,
  useUsageContext,
} from './usageContext';
import type { ModuleUsageMode, UsageKind, UsageContext } from './usageContext';
import { FleetGate } from './FleetStatus';
import { UsageRanking } from './UsageRanking';
import { UsageOverviewCard } from './UsageOverviewCard';
import { VersionDistributionCard } from './VersionDistributionCard';
import { ModuleStackUsageTableCard } from './ModuleStackUsageTableCard';
import { SegmentedToggle } from '../../../shared/components/SegmentedToggle';
import { useStackModuleUsage } from './stackModuleUsage';

const MODULE_USAGE_MODE_OPTIONS: readonly { value: ModuleUsageMode; label: string }[] = [
  { value: 'both', label: MODULE_USAGE_MODE_LABEL.both },
  { value: 'standalone', label: MODULE_USAGE_MODE_LABEL.standalone },
  { value: 'in-stacks', label: MODULE_USAGE_MODE_LABEL['in-stacks'] },
];

type UsageViewDataParams = {
  fleet: ReturnType<typeof useFleetDeployments>;
  kind: UsageKind;
  context: UsageContext;
};

type SourceDeploymentParams = {
  deployments: Deployment[];
  kind: UsageKind;
  moduleUsageMode: ModuleUsageMode;
  stackCatalogueNames: Set<string>;
  stackUses: Deployment[];
};

const getSourceDeployments = ({
  deployments,
  kind,
  moduleUsageMode,
  stackCatalogueNames,
  stackUses,
}: SourceDeploymentParams): Deployment[] => {
  if (kind === 'stack') {
    return deployments.filter((deployment) => isStackDeployment(deployment, stackCatalogueNames));
  }
  if (moduleUsageMode === 'in-stacks') {
    return stackUses;
  }

  const standaloneDeployments = deployments.filter(
    (deployment) => !isStackDeployment(deployment, stackCatalogueNames),
  );
  return moduleUsageMode === 'both'
    ? [...standaloneDeployments, ...stackUses]
    : standaloneDeployments;
};

const getRankingDescription = (kind: UsageKind, moduleUsageMode: ModuleUsageMode) => {
  if (kind === 'module' && moduleUsageMode === 'in-stacks') {
    return (
      <>
        Every module used by deployed stacks, by number of active uses. Select one to see where it
        runs and on which versions.
      </>
    );
  }
  if (kind === 'module' && moduleUsageMode === 'both') {
    return (
      <>
        Every module in the registry or used by deployed stacks, by number of deployments and uses.
        Select one to see where it runs and on which versions.
      </>
    );
  }
  return `Every ${kind} in the registry, by number of active deployments. Select one to see where it runs and on which versions.`;
};

const useUsageViewData = ({ fleet, kind, context }: UsageViewDataParams) => {
  const selectedName = context.module ?? '';
  const moduleUsageMode = context.moduleUsageMode ?? DEFAULT_MODULE_USAGE_MODE;
  const filters = React.useMemo(
    () => ({ region: context.region, account: context.account }),
    [context.region, context.account],
  );

  const stackCatalogueNames = React.useMemo(
    () => new Set(fleet.stackCatalogue.map(moduleName)),
    [fleet.stackCatalogue],
  );
  const stackDeployments = React.useMemo(
    () =>
      fleet.deployments.filter((deployment) => isStackDeployment(deployment, stackCatalogueNames)),
    [fleet.deployments, stackCatalogueNames],
  );

  const includeStackModuleUsage = kind === 'module' && moduleUsageMode !== 'standalone';
  const loadStackCompositions =
    kind === 'module' && (includeStackModuleUsage || selectedName !== '');
  const stackModuleUsage = useStackModuleUsage(loadStackCompositions ? stackDeployments : []);

  const registeredNames = React.useMemo(() => {
    if (kind === 'module' && moduleUsageMode === 'in-stacks') {
      return [];
    }
    const catalogue = kind === 'stack' ? fleet.stackCatalogue : fleet.moduleCatalogue;
    return catalogue.map(moduleName).filter(Boolean);
  }, [kind, moduleUsageMode, fleet.stackCatalogue, fleet.moduleCatalogue]);

  // Choose the source before applying the account and region filters.
  const visibleDeployments = React.useMemo(() => {
    const sourceDeployments = getSourceDeployments({
      deployments: fleet.deployments,
      kind,
      moduleUsageMode,
      stackCatalogueNames,
      stackUses: stackModuleUsage.uses,
    });
    return sourceDeployments.filter((deployment) => matchesFilters(deployment, filters));
  }, [
    fleet.deployments,
    kind,
    moduleUsageMode,
    stackCatalogueNames,
    stackModuleUsage.uses,
    filters,
  ]);

  // Keep registered, deployed, and currently selected names available to the overview.
  const availableNames = React.useMemo(() => {
    const names = [
      ...registeredNames,
      ...visibleDeployments.map((deployment) => deployment.module),
      selectedName,
    ].filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [registeredNames, visibleDeployments, selectedName]);
  const selectedDeployments = React.useMemo(
    () =>
      selectedName
        ? visibleDeployments.filter((deployment) => deployment.module === selectedName)
        : [],
    [visibleDeployments, selectedName],
  );

  return {
    countNoun: COUNT_NOUN[kind === 'module' ? moduleUsageMode : 'standalone'],
    filters,
    includeDirectDeployments: kind !== 'module' || moduleUsageMode !== 'in-stacks',
    includeStackModuleUsage,
    visibleDeployments,
    stackModuleUsageLoading: includeStackModuleUsage && stackModuleUsage.loading,
    moduleUsageMode,
    availableNames,
    registeredNames,
    selectedDeployments,
    selectedName,
    stackModuleUsageIncomplete: includeStackModuleUsage && stackModuleUsage.incomplete,
    stackModuleUsage,
  };
};

const asOptionalSingleton = (value: string | undefined): string[] | undefined =>
  value ? [value] : undefined;

export const UsageView = ({ kind, onBack }: { kind: UsageKind; onBack: () => void }) => {
  const fleet = useFleetDeployments();
  const { context, set, setModuleUsageMode } = useUsageContext();
  const {
    countNoun,
    filters,
    includeDirectDeployments,
    includeStackModuleUsage,
    visibleDeployments,
    stackModuleUsageLoading,
    moduleUsageMode,
    availableNames,
    registeredNames,
    selectedDeployments,
    selectedName,
    stackModuleUsageIncomplete,
    stackModuleUsage,
  } = useUsageViewData({ fleet, kind, context });

  const overviewRef = React.useRef<HTMLDivElement>(null);
  const [openDeployments, setOpenDeployments] = useState(false);
  const [selectedVersionForModal, setSelectedVersionForModal] = useState('');
  const setSelectedName = (name: string) => set('module', name || undefined);
  const handleVersionClick = (version: string) => {
    setSelectedVersionForModal(version);
    setOpenDeployments(true);
  };
  const scrollToOverview = () => scrollToSection(overviewRef);
  const selectFromRanking = (name: string) => {
    setSelectedName(name);
    scrollToOverview();
  };
  useScrollToOpenedSelection(
    selectedName,
    fleet.fetchedAt > 0 && fleet.accessKnown,
    scrollToOverview,
  );

  const fleetScope = stackModuleUsageLoading
    ? undefined
    : {
        deployments: visibleDeployments,
        noun: {
          singular: `${kind} ${countNoun.singular}`,
          plural: `${kind} ${countNoun.plural}`,
        },
      };
  const accountHref = (projectId: string) =>
    usageHref('account-usage', {
      account: projectId,
      module: selectedName,
      kind,
      moduleUsageMode: kind === 'module' ? moduleUsageMode : undefined,
      region: filters.region,
    });

  if (fleet.error) return <ResponseErrorPanel error={fleet.error} />;

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Box mb={2}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
            Back to Dashboard
          </Button>
        </Box>
        <FleetGate fleet={fleet} scope={fleetScope}>
          <ContextFilters
            filters={filters}
            projectNames={fleet.projectNames}
            onClear={(key) => set(key, undefined)}
          />
          {kind === 'module' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Source
              </Typography>
              <SegmentedToggle
                value={moduleUsageMode}
                options={MODULE_USAGE_MODE_OPTIONS}
                onChange={setModuleUsageMode}
                ariaLabel="Module usage source"
              />
              <ModuleUsageSourceHelp />
            </Box>
          )}
          <Card variant="outlined" sx={{ width: '100%', mb: 3 }}>
            <CardHeader
              title={`Most deployed ${kind}s`}
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            />
            <CardContent>
              <Typography variant="body1" paragraph>
                {getRankingDescription(kind, moduleUsageMode)}
              </Typography>
              {stackModuleUsageIncomplete && (
                <Alert severity="warning" role="status" sx={{ mb: 2 }}>
                  Some deployed stack compositions could not be loaded, so within-stack module usage
                  may be incomplete.
                </Alert>
              )}
              {stackModuleUsageLoading ? (
                <LinearProgress aria-label="Loading deployed stack compositions" />
              ) : (
                <UsageRanking
                  kind={kind}
                  deployments={visibleDeployments}
                  registered={registeredNames}
                  loading={fleet.loadingCatalog}
                  selected={selectedName}
                  onSelect={selectFromRanking}
                  countNoun={countNoun}
                />
              )}
            </CardContent>
          </Card>

          {!stackModuleUsageLoading && (
            <UsageOverviewCard
              kind={kind}
              selectedName={selectedName}
              options={availableNames}
              deployments={selectedDeployments}
              projectNames={fleet.projectNames}
              filters={filters}
              moduleUsageMode={kind === 'module' ? moduleUsageMode : undefined}
              stackDataIncomplete={stackModuleUsageIncomplete}
              overviewRef={overviewRef}
              onSelectName={setSelectedName}
              onVersionClick={handleVersionClick}
              accountHref={accountHref}
            />
          )}

          {selectedName && !stackModuleUsageLoading && (
            <VersionDistributionCard
              key={kind === 'module' ? `${selectedName}:${moduleUsageMode}` : selectedName}
              kind={kind}
              deployments={selectedDeployments}
              onVersionClick={handleVersionClick}
              countNoun={countNoun}
            />
          )}

          {includeStackModuleUsage && selectedName && (
            <ModuleStackUsageTableCard
              key={selectedName}
              selectedModuleName={selectedName}
              uses={stackModuleUsage.uses}
              filters={filters}
              loading={stackModuleUsage.loading}
              incomplete={stackModuleUsage.incomplete}
            />
          )}

          {/* The dialog is shared by version links from both cards. */}
          {openDeployments && selectedName && !stackModuleUsageLoading && (
            <DeploymentsDialog
              open={openDeployments}
              onClose={() => setOpenDeployments(false)}
              moduleName={selectedName}
              version={selectedVersionForModal}
              resourceType={kind}
              rowLabel={countNoun.label}
              initialProjectIds={asOptionalSingleton(filters.account)}
              initialRegions={asOptionalSingleton(filters.region)}
              // Unfiltered by the page's account and region: the dialog narrows them itself and
              // lets the user widen its selection.
              stackModuleDeployments={
                includeStackModuleUsage
                  ? stackModuleUsage.uses.filter((use) => use.module === selectedName)
                  : []
              }
              includeDirectDeployments={includeDirectDeployments}
            />
          )}
        </FleetGate>
      </Grid>
    </Grid>
  );
};
