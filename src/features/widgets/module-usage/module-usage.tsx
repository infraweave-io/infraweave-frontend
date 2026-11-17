import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { Link, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { ListIncomplete } from '../../../shared/components/ListIncomplete';
import {
  isStackDeployment,
  moduleName,
  useFleetDeployments,
} from '../../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { usageHref } from '../../adoption-health/AdoptionHealthPage/usageContext';
import { INCOMPLETE_REASON_TEXT } from '../../../utils/deploymentFetch';
import { isFailedDeployment } from '../../../utils/deploymentStatus';

/** A widget is a preview; the full ranking lives on the Module usage page. */
const MAX_ROWS = 6;

type ModuleRow = {
  name: string;
  count: number;
  failing: number;
  accounts: number;
  versions: number;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const ago = (epoch: number): string => {
  const minutes = Math.max(0, Math.round((Date.now() - epoch) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
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
      .map(
        ([name, row]): ModuleRow => ({
          name,
          count: row.count,
          failing: row.failing,
          accounts: row.accounts.size,
          versions: row.versions.size,
        }),
      )
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

  if (fleet.error) {
    return <ResponseErrorPanel error={fleet.error} title="Could not load accounts" />;
  }

  if (fleet.nothingToLoad) {
    return (
      <Typography variant="body2" color="text.secondary">
        None of your accounts has a region configured, so there are no deployments to count.
      </Typography>
    );
  }

  // The stack list is needed to tell modules from stacks, so wait for the catalogue too.
  if (!fleet.accessKnown || fleet.fetchedAt === 0 || fleet.loadingCatalog) {
    if (fleet.loadFailed) {
      return <ResponseErrorPanel error={new Error('Deployments could not be loaded.')} />;
    }
    return (
      <Stack spacing={1} aria-busy="true" aria-label="Loading module usage">
        {[100, 75, 55, 40].map((width) => (
          <Skeleton key={width} variant="rounded" height={20} width={`${width}%`} />
        ))}
      </Stack>
    );
  }

  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No modules are deployed in your accounts yet.
      </Typography>
    );
  }

  const shown = rows.slice(0, MAX_ROWS);
  // Sorted by count, so the first row is the longest bar.
  const max = shown[0].count;

  return (
    <Box>
      {fleet.loadFailed && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          The last refresh failed, so these numbers are from {ago(fleet.fetchedAt)}.
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {rows.length} of {plural(knownCount, 'module')} have active deployments.
      </Typography>

      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {shown.map((row) => (
          <li key={row.name}>
            <Tooltip
              placement="top"
              arrow
              title={[
                plural(row.count, 'deployment'),
                `${row.failing} failing`,
                plural(row.accounts, 'account'),
                plural(row.versions, 'version'),
              ].join(' · ')}
            >
              {/* The whole row is the link and the hover target, not just the thin bar. */}
              <Box
                component={RouterLink}
                to={usageHref('module-usage', { module: row.name, kind: 'module' })}
                aria-label={`${row.name}: ${plural(row.count, 'deployment')}, ${
                  row.failing
                } failing`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr) auto',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 0.75,
                  px: 0.5,
                  mx: -0.5,
                  borderRadius: 1,
                  color: 'inherit',
                  textDecoration: 'none',
                  '&:hover, &:focus-visible': { bgcolor: 'action.hover' },
                }}
              >
                <Typography variant="body2" noWrap sx={{ color: 'primary.main' }}>
                  {row.name}
                </Typography>
                <Box
                  sx={{
                    height: 8,
                    width: `${(row.count / max) * 100}%`,
                    bgcolor: 'primary.main',
                    // Squared at the baseline, rounded at the data end.
                    borderRadius: '0 4px 4px 0',
                  }}
                />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: 24 }}
                >
                  {row.count}
                </Typography>
              </Box>
            </Tooltip>
          </li>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
        Updated {ago(fleet.fetchedAt)} ·{' '}
        <Link to={usageHref('module-usage', {})}>Open module usage</Link>
      </Typography>

      {fleet.incomplete && (
        <ListIncomplete
          label="deployments"
          reason={INCOMPLETE_REASON_TEXT[fleet.incomplete]}
          retry="It will retry on the next refresh."
        />
      )}
    </Box>
  );
};
