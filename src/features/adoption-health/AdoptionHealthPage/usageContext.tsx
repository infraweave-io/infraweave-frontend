import React from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Button, Chip, Link as MuiLink, Tooltip, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Deployment } from '../../../types/Deployment';
import { regionName } from './fleetSummary';

/**
 * Usage page context, kept in the URL so pages can link to each other with the drill-down
 * open, e.g. `module-usage?module=vpc&region=eu-central-1`.
 */

export type UsageView = 'module-usage' | 'stack-usage' | 'region-usage' | 'account-usage';

export type ContextKey = 'module' | 'region' | 'account';

export type UsageKind = 'module' | 'stack';

export type ModuleUsageMode = 'standalone' | 'in-stacks' | 'both';

/** Mode used when the URL has none. The URL omits the query parameter for this mode. */
export const DEFAULT_MODULE_USAGE_MODE: ModuleUsageMode = 'both';

export type UsageContext = Partial<Record<ContextKey, string>> & {
  kind?: UsageKind;
  /** A version of the selected name. The usage page opens its deployments dialog. */
  version?: string;
  moduleUsageMode?: ModuleUsageMode;
};

const CONTEXT_KEYS: ContextKey[] = ['module', 'region', 'account'];

const isUsageKind = (value: string | null): value is UsageKind =>
  value === 'module' || value === 'stack';

const isModuleUsageMode = (value: string | null): value is ModuleUsageMode =>
  value === 'standalone' || value === 'in-stacks' || value === 'both';

export const usageHref = (view: UsageView, context: UsageContext): string => {
  const params = new URLSearchParams();
  for (const key of CONTEXT_KEYS) {
    const value = context[key];
    if (value) params.set(key, value);
    if (key === 'module' && value && context.kind) params.set('kind', context.kind);
    if (key === 'module' && value && context.version) params.set('version', context.version);
  }
  if (context.moduleUsageMode && context.moduleUsageMode !== DEFAULT_MODULE_USAGE_MODE) {
    params.set('moduleUsageMode', context.moduleUsageMode);
  }
  const query = params.toString();
  return `/infraweave/adoption-health/${view}${query ? `?${query}` : ''}`;
};

/** `set` changes one key and keeps the rest. */
export const useUsageContext = () => {
  const [params, setParams] = useSearchParams();
  const requestedMode = params.get('moduleUsageMode');
  const context: UsageContext = {
    moduleUsageMode: isModuleUsageMode(requestedMode) ? requestedMode : DEFAULT_MODULE_USAGE_MODE,
  };
  for (const key of CONTEXT_KEYS) {
    const value = params.get(key);
    if (value) context[key] = value;
  }
  const kind = params.get('kind');
  if (context.module && isUsageKind(kind)) context.kind = kind;
  const version = params.get('version');
  if (context.module && version) context.version = version;

  const set = React.useCallback(
    (key: ContextKey, value: string | undefined) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set(key, value);
          else next.delete(key);
          // The usage kind and version belong to the selected name.
          if (key === 'module') {
            next.delete('kind');
            next.delete('version');
          }
          return next;
        },
        // In-page picks replace the history entry; only links add one.
        { replace: true },
      ),
    [setParams],
  );

  const setVersion = React.useCallback(
    (version: string | undefined) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (version) next.set('version', version);
          else next.delete('version');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  const setModuleUsageMode = React.useCallback(
    (mode: ModuleUsageMode) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (mode === DEFAULT_MODULE_USAGE_MODE) next.delete('moduleUsageMode');
          else next.set('moduleUsageMode', mode);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  return { context, set, setVersion, setModuleUsageMode };
};

export const matchesFilters = (
  d: Deployment,
  filters: UsageContext,
  isStack?: (d: Deployment) => boolean,
): boolean => {
  const matchesModule = !filters.module || d.module === filters.module;
  // Kind disambiguates a selected name only when this caller can classify deployments.
  const matchesSelectedKind =
    !filters.module || !filters.kind || !isStack || isStack(d) === (filters.kind === 'stack');
  const matchesRegion = !filters.region || d.region === filters.region;
  const matchesAccount = !filters.account || d.project_id === filters.account;

  return matchesModule && matchesSelectedKind && matchesRegion && matchesAccount;
};

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

export const MODULE_USAGE_MODE_LABEL: Record<ModuleUsageMode, string> = {
  standalone: 'Standalone',
  'in-stacks': 'Within stacks',
  both: 'Both',
};

/** How counts are worded. A row expanded from a deployed stack is a component use, not a deployment. */
export type CountNoun = {
  singular: string;
  plural: string;
  label: string;
};

export const COUNT_NOUN: Record<ModuleUsageMode, CountNoun> = {
  standalone: {
    singular: 'deployment',
    plural: 'deployments',
    label: 'Deployments',
  },
  'in-stacks': {
    singular: 'use',
    plural: 'uses',
    label: 'Uses',
  },
  both: {
    singular: 'deployment or use',
    plural: 'deployments and uses',
    label: 'Deployments and uses',
  },
};

const sourceLabel = (filters: UsageContext): string | undefined =>
  filters.module && filters.kind === 'module'
    ? MODULE_USAGE_MODE_LABEL[filters.moduleUsageMode ?? DEFAULT_MODULE_USAGE_MODE]
    : undefined;

/** Optional explanation for the source selector and module drill-downs. */
export const ModuleUsageSourceHelp = () => (
  <Tooltip
    title="Within-stack module status, failures, and drift reflect the parent stack deployment, not a separate child deployment."
    describeChild
    arrow
    placement="bottom-start"
    enterTouchDelay={0}
    leaveTouchDelay={10000}
  >
    <Button size="small" startIcon={<InfoOutlinedIcon fontSize="small" />}>
      About stack metrics
    </Button>
  </Tooltip>
);

/** Compact cue for overview cards scrolled past the full warning. */
export const StackUsageIncompleteChip = () => (
  <Chip size="small" color="warning" variant="outlined" label="Counts may be incomplete" />
);

/** One-line filter summary for sections where the filter chips are scrolled out of view. */
export const filterSummary = (
  filters: UsageContext,
  projectNames: Record<string, string>,
): string | undefined => {
  const parts = CONTEXT_KEYS.filter((key) => filters[key]).map((key) =>
    filterText(key, filters, projectNames),
  );
  const source = sourceLabel(filters);
  if (source) parts.push(`Source: ${source}`);
  return parts.length > 0 ? `Showing only ${parts.join(', ')}` : undefined;
};

/** Removable filter chips and the source of a selected module's drill-down. */
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
  const source = sourceLabel(filters);
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
      {source && (
        <>
          <Chip size="small" variant="outlined" label={`Source: ${source}`} />
          <ModuleUsageSourceHelp />
        </>
      )}
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
