import React from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Chip, Link as MuiLink, Typography } from '@mui/material';
import { Deployment } from '../../../types/Deployment';
import { regionName } from './fleetSummary';

/**
 * Usage page context, kept in the URL so pages can link to each other with the drill-down
 * open, e.g. `module-usage?module=vpc&region=eu-central-1`.
 */

export type UsageView = 'module-usage' | 'stack-usage' | 'region-usage' | 'account-usage';

export type ContextKey = 'module' | 'region' | 'account';

export type ModuleKind = 'module' | 'stack';

/**
 * `kind` says whether `module` names a module or a stack, since the two can share a name. It
 * only means something next to `module`, so it is dropped without one.
 */
export type UsageContext = Partial<Record<ContextKey, string>> & { kind?: ModuleKind };

const CONTEXT_KEYS: ContextKey[] = ['module', 'region', 'account'];

const isModuleKind = (value: string | null): value is ModuleKind =>
  value === 'module' || value === 'stack';

export const usageHref = (view: UsageView, context: UsageContext): string => {
  const params = new URLSearchParams();
  for (const key of CONTEXT_KEYS) {
    const value = context[key];
    if (value) params.set(key, value);
    if (key === 'module' && value && context.kind) params.set('kind', context.kind);
  }
  const query = params.toString();
  return `/infraweave/adoption-health/${view}${query ? `?${query}` : ''}`;
};

/** `set` changes one key and keeps the rest. */
export const useUsageContext = () => {
  const [params, setParams] = useSearchParams();
  const context: UsageContext = {};
  for (const key of CONTEXT_KEYS) {
    const value = params.get(key);
    if (value) context[key] = value;
  }
  const kind = params.get('kind');
  if (context.module && isModuleKind(kind)) context.kind = kind;

  const set = React.useCallback(
    (key: ContextKey, value: string | undefined) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set(key, value);
          else next.delete(key);
          // The kind belongs to the module it came with.
          if (key === 'module') next.delete('kind');
          return next;
        },
        // In-page picks replace the history entry; only links add one.
        { replace: true },
      ),
    [setParams],
  );

  return { context, set };
};

/** `isStack` is needed to honour `filters.kind`. */
export const matchesFilters = (
  d: Deployment,
  filters: UsageContext,
  isStack?: (d: Deployment) => boolean,
): boolean =>
  (!filters.module || d.module === filters.module) &&
  (!filters.module || !filters.kind || !isStack || isStack(d) === (filters.kind === 'stack')) &&
  (!filters.region || d.region === filters.region) &&
  (!filters.account || d.project_id === filters.account);

export const UsageLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <MuiLink
    component={RouterLink}
    to={to}
    underline="hover"
    variant="body2"
    // Keep the click from also selecting the row.
    onClick={(event: React.MouseEvent) => event.stopPropagation()}
  >
    {children}
  </MuiLink>
);

const FILTER_LABEL: Record<ContextKey, string> = {
  module: 'Module',
  region: 'Region',
  account: 'Account',
};

/** `module` holds a module or a stack name; `kind` says which. */
const filterLabel = (key: ContextKey, filters: UsageContext): string =>
  key === 'module' && filters.kind === 'stack' ? 'Stack' : FILTER_LABEL[key];

const describeFilter = (
  key: ContextKey,
  value: string,
  projectNames: Record<string, string>,
): string => {
  if (key === 'region') {
    const name = regionName(value);
    return name ? `${value} (${name})` : value;
  }
  if (key === 'account') return projectNames[value] ?? value;
  return value;
};

/** `Region: eu-west-1 (Ireland)`, for a chip or the summary line. */
const filterText = (
  key: ContextKey,
  filters: UsageContext,
  projectNames: Record<string, string>,
): string => `${filterLabel(key, filters)}: ${describeFilter(key, filters[key]!, projectNames)}`;

/** One-line filter summary for sections where the filter chips are scrolled out of view. */
export const filterSummary = (
  filters: UsageContext,
  projectNames: Record<string, string>,
): string | undefined => {
  const parts = CONTEXT_KEYS.filter((key) => filters[key]).map((key) =>
    filterText(key, filters, projectNames),
  );
  return parts.length > 0 ? `Showing only ${parts.join(', ')}` : undefined;
};

/** Removable chips for the active filters, so a page opened from a link shows it is filtered. */
export const ContextFilters = ({
  filters,
  projectNames,
  onClear,
}: {
  filters: UsageContext;
  projectNames: Record<string, string>;
  onClear: (key: ContextKey) => void;
}) => {
  const active = CONTEXT_KEYS.filter((key) => filters[key]);
  if (active.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Showing only
      </Typography>
      {active.map((key) => (
        <Chip
          key={key}
          size="small"
          label={filterText(key, filters, projectNames)}
          onDelete={() => onClear(key)}
        />
      ))}
    </Box>
  );
};

/** Scrolls to the selection once, when the page is opened from a link with one already set. */
export const useScrollToOpenedSelection = (
  selected: string | undefined,
  ready: boolean,
  scroll: () => void,
) => {
  const done = React.useRef(false);
  React.useEffect(() => {
    if (done.current || !ready) return;
    done.current = true;
    if (selected) scroll();
    // Only the first time the page is ready counts as arriving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
};
