import React from 'react';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import {
  isStackDeployment,
  moduleName,
  useFleetDeployments,
} from '../../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { usageHref } from '../../adoption-health/AdoptionHealthPage/usageContext';
import { isFailedDeployment } from '../../../utils/deploymentStatus';
import { plural } from '../../../utils/format';
import { BarRow } from '../BarRow';
import { FleetGate } from '../FleetGate';

/** A widget is a preview; the full ranking lives on the Module usage page. */
const MAX_ROWS = 6;

type ModuleRow = {
  name: string;
  count: number;
  failing: number;
  accounts: number;
  versions: number;
};

/**
 * The most deployed modules across every account the user can see. Counted the same way as
 * the Module usage ranking, from the shared fleet cache.
 */
export const TopModulesChart = () => {
  const fleet = useFleetDeployments();

  const rows = React.useMemo(() => {
    const stackNames = new Set(fleet.stackCatalogue.map(moduleName));
    const byName = new Map<
      string,
      { count: number; failing: number; accounts: Set<string>; versions: Set<string> }
    >();
    for (const d of fleet.deployments) {
      if (!d.module || isStackDeployment(d, stackNames)) continue;
      let row = byName.get(d.module);
      if (!row) {
        row = { count: 0, failing: 0, accounts: new Set(), versions: new Set() };
        byName.set(d.module, row);
      }
      row.count += 1;
      if (isFailedDeployment(d)) row.failing += 1;
      if (d.project_id) row.accounts.add(d.project_id);
      if (d.module_version) row.versions.add(d.module_version);
    }
    return Array.from(byName.entries())
      .map(([name, row]): ModuleRow => ({
        name,
        count: row.count,
        failing: row.failing,
        accounts: row.accounts.size,
        versions: row.versions.size,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [fleet.deployments, fleet.stackCatalogue]);

  // Registry entries plus anything deployed under a name the registry no longer has, as the
  // Module usage ranking counts them, so "N of M" can never read more in use than exist.
  const knownCount = React.useMemo(
    () =>
      new Set(
        [...fleet.moduleCatalogue.map(moduleName), ...rows.map((row) => row.name)].filter(Boolean),
      ).size,
    [fleet.moduleCatalogue, rows],
  );

  const shown = rows.slice(0, MAX_ROWS);
  // Sorted by count, so the first row is the longest bar.
  const max = shown[0]?.count ?? 1;

  return (
    <FleetGate
      fleet={fleet}
      // The stack list is needed to tell modules from stacks, so wait for the catalogue too.
      waitForCatalog
      skeleton={
        <Stack spacing={1} aria-busy="true" aria-label="Loading module usage">
          {[100, 75, 55, 40].map((width) => (
            <Skeleton key={width} variant="rounded" height={20} width={`${width}%`} />
          ))}
        </Stack>
      }
      showUpdated
    >
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No modules are deployed in your accounts yet.
        </Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {rows.length} of {plural(knownCount, 'module')} have active deployments.
          </Typography>

          <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {shown.map((row) => (
              <li key={row.name}>
                <BarRow
                  name={row.name}
                  to={usageHref('module-usage', { module: row.name, kind: 'module' })}
                  ariaLabel={`${row.name}: ${plural(row.count, 'deployment')}, ${
                    row.failing
                  } failing`}
                  tooltip={[
                    plural(row.count, 'deployment'),
                    `${row.failing} failing`,
                    plural(row.accounts, 'account'),
                    plural(row.versions, 'version'),
                  ].join(' · ')}
                  fraction={row.count / max}
                  color="primary.main"
                  value={row.count}
                />
              </li>
            ))}
          </Box>
        </>
      )}
    </FleetGate>
  );
};
