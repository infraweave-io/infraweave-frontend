import React, { useMemo } from 'react';
import { Alert } from '@mui/material';
import {
  isStackDeployment,
  moduleName as catalogueModuleName,
  useFleetDeployments,
} from './useFleetDeployments';
import { DEFAULT_MODULE_USAGE_MODE, matchesFilters, useUsageContext } from './usageContext';
import { DeploymentExplorerTable } from './DeploymentExplorerTable';
import { useStackModuleUsage } from './stackModuleUsage';

const NO_DEPLOYMENTS: never[] = [];

/** Explores module deployments, standalone or inside deployed stacks, chosen by Source. */
export const ModuleStackUsageExplorerCard = () => {
  const fleet = useFleetDeployments();
  const { context, setModuleUsageMode } = useUsageContext();
  const mode = context.moduleUsageMode ?? DEFAULT_MODULE_USAGE_MODE;
  const stackNames = useMemo(
    () => new Set(fleet.stackCatalogue.map(catalogueModuleName)),
    [fleet.stackCatalogue],
  );
  const filters = useMemo(
    () => ({ account: context.account, region: context.region }),
    [context.account, context.region],
  );
  const includeStackUses = mode !== 'standalone';
  const includeStandalone = mode !== 'in-stacks';

  // Compositions are only fetched when stack uses are shown.
  const stackDeployments = useMemo(
    () =>
      includeStackUses
        ? fleet.deployments.filter(
            (deployment) =>
              isStackDeployment(deployment, stackNames) && matchesFilters(deployment, filters),
          )
        : NO_DEPLOYMENTS,
    [includeStackUses, fleet.deployments, stackNames, filters],
  );
  const standaloneDeployments = useMemo(
    () =>
      includeStandalone
        ? fleet.deployments.filter(
            (deployment) =>
              !isStackDeployment(deployment, stackNames) && matchesFilters(deployment, filters),
          )
        : NO_DEPLOYMENTS,
    [includeStandalone, fleet.deployments, stackNames, filters],
  );
  const usage = useStackModuleUsage(stackDeployments);

  const loading =
    !fleet.accessKnown || fleet.loadingCatalog || fleet.loadingDeployments || usage.loading;
  const incomplete = fleet.catalogueIncomplete || Boolean(fleet.incomplete) || usage.incomplete;

  return (
    <>
      {fleet.error && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          Account access could not be loaded, so deployments may be unavailable.
        </Alert>
      )}
      {fleet.loadFailed && (
        <Alert severity="warning" role="status" sx={{ mb: 2 }}>
          The fleet could not be fully refreshed; this table may show only previously loaded
          deployments.
        </Alert>
      )}
      <DeploymentExplorerTable
        source={mode}
        onSourceChange={setModuleUsageMode}
        stackUses={includeStackUses ? usage.uses : NO_DEPLOYMENTS}
        standaloneDeployments={standaloneDeployments}
        filters={filters}
        projectNames={fleet.projectNames}
        loading={loading}
        incomplete={incomplete}
      />
    </>
  );
};
