import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { Link, ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { ListIncomplete } from '../../../shared/components/ListIncomplete';
import { useChartStatusColors } from '../../../contexts/ThemeContext';
import {
  isStackDeployment,
  moduleName,
  useFleetDeployments,
} from '../../adoption-health/AdoptionHealthPage/useFleetDeployments';
import { usageHref } from '../../adoption-health/AdoptionHealthPage/usageContext';
import { INCOMPLETE_REASON_TEXT } from '../../../utils/deploymentFetch';
import { isFailedDeployment } from '../../../utils/deploymentStatus';

/** A widget is a preview; the full breakdown lives on the Issues page. */
const MAX_ROWS = 6;

type Kind = 'module' | 'stack';

type IssueRow = {
  name: string;
  kind: Kind;
  total: number;
  failed: number;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const rate = (row: IssueRow) => Math.round((row.failed / row.total) * 100);

const ago = (epoch: number): string => {
  const minutes = Math.max(0, Math.round((Date.now() - epoch) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

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

  if (fleet.error) {
    return <ResponseErrorPanel error={fleet.error} title="Could not load accounts" />;
  }

  if (fleet.nothingToLoad) {
    return (
      <Typography variant="body2" color="text.secondary">
        None of your accounts has a region configured, so there are no deployments to check.
      </Typography>
    );
  }

  // The stack list is needed to tell modules from stacks, so wait for the catalogue too.
  if (!fleet.accessKnown || fleet.fetchedAt === 0 || fleet.loadingCatalog) {
    if (fleet.loadFailed) {
      return <ResponseErrorPanel error={new Error('Deployments could not be loaded.')} />;
    }
    return (
      <Stack spacing={1} aria-busy="true" aria-label="Loading module issues">
        {[100, 70, 45].map((width) => (
          <Skeleton key={width} variant="rounded" height={20} width={`${width}%`} />
        ))}
      </Stack>
    );
  }

  const shown = rows.slice(0, MAX_ROWS);
  // Sorted by failures, so the first row is the longest bar.
  const max = shown[0]?.failed ?? 1;

  return (
    <Box>
      {fleet.loadFailed && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          The last refresh failed, so these numbers are from {ago(fleet.fetchedAt)}.
        </Alert>
      )}

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
                <Tooltip
                  placement="top"
                  arrow
                  title={`${row.failed} of ${plural(row.total, 'deployment')} failing (${rate(
                    row,
                  )}%)`}
                >
                  {/* The whole row is the link and the hover target, not just the thin bar. */}
                  <Box
                    component={RouterLink}
                    to={usageHref(row.kind === 'stack' ? 'stack-usage' : 'module-usage', {
                      module: row.name,
                      kind: row.kind,
                    })}
                    aria-label={`${row.name}${row.kind === 'stack' ? ' (stack)' : ''}: ${
                      row.failed
                    } of ${plural(row.total, 'deployment')} failing`}
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
                    <Typography variant="body2" noWrap>
                      <Box component="span" sx={{ color: 'primary.main' }}>
                        {row.name}
                      </Box>
                      {row.kind === 'stack' && (
                        <Box component="span" sx={{ color: 'text.secondary' }}>
                          {' '}
                          · stack
                        </Box>
                      )}
                    </Typography>
                    <Box
                      sx={{
                        height: 8,
                        width: `${(row.failed / max) * 100}%`,
                        bgcolor: colors.failed,
                        // Squared at the baseline, rounded at the data end.
                        borderRadius: '0 4px 4px 0',
                      }}
                    />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      noWrap
                      sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
                    >
                      {row.failed} failing · {rate(row)}%
                    </Typography>
                  </Box>
                </Tooltip>
              </li>
            ))}
          </Box>
        </>
      )}

      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
        Updated {ago(fleet.fetchedAt)} ·{' '}
        <Link to="/infraweave/adoption-health/issues">Open issues</Link>
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
