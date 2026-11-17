import React from 'react';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { useChartStatusColors } from '../../../contexts/ThemeContext';
import {
  isStackDeployment,
  moduleName,
  useFleetDeployments,
} from '../../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { usageHref } from '../../adoption-health/AdoptionHealthPage/usageContext';
import { isFailedDeployment } from '../../../utils/deploymentStatus';
import { ago, plural } from '../../../utils/format';
import { BarRow } from '../BarRow';
import { FleetGate } from '../FleetGate';

/** A widget is a preview; the full breakdown lives on the Issues page. */
const MAX_ROWS = 6;

type Kind = 'module' | 'stack';

type IssueRow = {
  name: string;
  kind: Kind;
  total: number;
  failed: number;
};

const rate = (row: IssueRow) => Math.round((row.failed / row.total) * 100);

/**
 * The modules and stacks with the most failing deployments, across every account the user
 * can see. Counted as on the Issues page, from the shared fleet cache.
 */
export const ModuleIssuesChart = () => {
  const fleet = useFleetDeployments();
  const colors = useChartStatusColors();

  const rows = React.useMemo(() => {
    const stackNames = new Set(fleet.stackCatalogue.map(moduleName));
    // Keyed by kind as well: a module and a stack can share a name.
    const byEntry = new Map<string, IssueRow>();
    for (const d of fleet.deployments) {
      const name = d.module || 'unknown';
      const kind: Kind = isStackDeployment(d, stackNames) ? 'stack' : 'module';
      const key = `${kind}:${name}`;
      let row = byEntry.get(key);
      if (!row) {
        row = { name, kind, total: 0, failed: 0 };
        byEntry.set(key, row);
      }
      row.total += 1;
      if (isFailedDeployment(d)) row.failed += 1;
    }
    return Array.from(byEntry.values())
      .filter((row) => row.failed > 0)
      .sort((a, b) => b.failed - a.failed || rate(b) - rate(a) || a.name.localeCompare(b.name));
  }, [fleet.deployments, fleet.stackCatalogue]);

  const shown = rows.slice(0, MAX_ROWS);
  // Sorted by failures, so the first row is the longest bar.
  const max = shown[0]?.failed ?? 1;

  return (
    <FleetGate
      fleet={fleet}
      // The stack list is needed to tell modules from stacks, so wait for the catalogue too.
      waitForCatalog
      skeleton={
        <Stack spacing={1} aria-busy="true" aria-label="Loading module issues">
          {[100, 70, 45].map((width) => (
            <Skeleton key={width} variant="rounded" height={20} width={`${width}%`} />
          ))}
        </Stack>
      }
      showUpdated
    >
      {rows.length === 0 ? (
        // Good news, but only as fresh as the last check, so say when that was.
        <Typography variant="body2" color="text.secondary">
          No modules or stacks have failing deployments. Checked {ago(fleet.fetchedAt)}.
        </Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {rows.length === 1
              ? '1 module or stack has failing deployments.'
              : `${rows.length} modules or stacks have failing deployments.`}
          </Typography>

          <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {shown.map((row) => (
              <li key={`${row.kind}:${row.name}`}>
                <BarRow
                  name={row.name}
                  note={row.kind === 'stack' ? 'stack' : undefined}
                  to={usageHref(row.kind === 'stack' ? 'stack-usage' : 'module-usage', {
                    module: row.name,
                    kind: row.kind,
                  })}
                  ariaLabel={`${row.name}${row.kind === 'stack' ? ' (stack)' : ''}: ${
                    row.failed
                  } of ${plural(row.total, 'deployment')} failing`}
                  tooltip={`${row.failed} of ${plural(row.total, 'deployment')} failing (${rate(
                    row,
                  )}%)`}
                  fraction={row.failed / max}
                  color={colors.failed}
                  value={`${row.failed} failing · ${rate(row)}%`}
                />
              </li>
            ))}
          </Box>
        </>
      )}
    </FleetGate>
  );
};
