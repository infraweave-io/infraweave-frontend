import React from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Link as MuiLink,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ResponseErrorPanel } from '../../../standalone/components/ComponentAdapter';
import { StatusChip } from '../../../shared/components/StatusChip';
import { Deployment } from '../../../types/Deployment';
import { FleetGate } from './FleetStatus';
import {
  countTone,
  CountBar,
  formatLastActivity,
  Metric,
  scrollToSection,
  statusTone,
  TABLE_MAX_HEIGHT,
} from './OverviewParts';
import {
  byAccount,
  byRegion,
  GroupOf,
  GroupRow,
  EntryRow,
  GroupSummary,
  regionName,
  summarizeGroup,
  summarizeGroups,
} from './fleetSummary';
import { isStackDeployment, moduleName, useFleetDeployments } from './useFleetDeployments';
import {
  ContextFilters,
  filterSummary,
  matchesFilters,
  usageHref,
  ModuleKind,
  UsageContext,
  UsageLink,
  useScrollToOpenedSelection,
  useUsageContext,
} from './usageContext';

/** Region and account usage pages, one view over the cached fleet. */

export type BreakdownDimension = 'region' | 'account';

/** `breakdownOf` and `other*` refer to the dimension each group splits into. */
type DimensionSpec = {
  noun: string;
  title: string;
  description: string;
  overviewTitle: string;
  groupOf: GroupOf;
  breakdownOf: GroupOf;
  otherLabel: string;
  otherCount: (row: { accounts: number; regions: number }) => number;
};

const DIMENSIONS: Record<BreakdownDimension, DimensionSpec> = {
  region: {
    noun: 'region',
    title: 'Deployments by region',
    description:
      'Regions your accounts deploy to, ranked by active deployments. Select one to see its modules, stacks and accounts.',
    overviewTitle: 'Region Overview',
    groupOf: byRegion,
    breakdownOf: byAccount,
    otherLabel: 'Accounts',
    otherCount: (row) => row.accounts,
  },
  account: {
    noun: 'account',
    title: 'Deployments by account',
    description:
      'Accounts you can see, ranked by active deployments. Select one to see its modules, stacks, versions and regions.',
    overviewTitle: 'Account Overview',
    groupOf: byAccount,
    breakdownOf: byRegion,
    otherLabel: 'Regions',
    otherCount: (row) => row.regions,
  },
};

const Named = ({ value, name }: { value: React.ReactNode; name?: string }) => (
  <>
    {value}
    {name && (
      <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
        {name}
      </Typography>
    )}
  </>
);

const GroupRanking = ({
  spec,
  rows,
  selected,
  onSelect,
  describe,
}: {
  spec: DimensionSpec;
  rows: GroupRow[];
  selected: string;
  onSelect: (key: string) => void;
  describe: (key: string) => { label: string; name?: string };
}) => {
  if (rows.length === 0) {
    return <Typography color="text.secondary">No {spec.noun}s found.</Typography>;
  }
  const inUse = rows.filter((row) => row.count > 0).length;
  const max = rows[0]?.count ?? 0;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {inUse} of {rows.length} {spec.noun}s have active deployments.
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: TABLE_MAX_HEIGHT }}>
        <Table size="small" stickyHeader aria-label={`${spec.noun}s by number of deployments`}>
          <TableHead>
            <TableRow>
              <TableCell>{spec.noun === 'region' ? 'Region' : 'Account'}</TableCell>
              <TableCell sx={{ width: '30%' }}>Deployments</TableCell>
              <TableCell align="right">Failing</TableCell>
              <TableCell align="right">{spec.otherLabel}</TableCell>
              <TableCell align="right">Modules</TableCell>
              <TableCell align="right">Stacks</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const { label, name } = describe(row.key);
              return (
                <TableRow
                  key={row.key}
                  hover
                  selected={row.key === selected}
                  onClick={() => onSelect(row.key)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell component="th" scope="row">
                    <Named
                      value={
                        <MuiLink
                          component="button"
                          variant="body2"
                          underline="hover"
                          onClick={(event: React.MouseEvent) => {
                            // The row handles clicks; the button is for keyboard access.
                            event.stopPropagation();
                            onSelect(row.key);
                          }}
                        >
                          {label}
                        </MuiLink>
                      }
                      name={name}
                    />
                  </TableCell>
                  <TableCell>
                    <CountBar
                      count={row.count}
                      max={max}
                      label={`${label}: ${row.count} deployments`}
                    />
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: row.failing > 0 ? 'error.main' : undefined }}
                  >
                    {row.failing}
                  </TableCell>
                  <TableCell align="right">{spec.otherCount(row)}</TableCell>
                  <TableCell align="right">{row.modules}</TableCell>
                  <TableCell align="right">{row.stacks}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

const GroupOverview = ({
  spec,
  label,
  summary,
  describeBreakdown,
  entryHref,
  breakdownHref,
}: {
  spec: DimensionSpec;
  label: string;
  summary: GroupSummary;
  describeBreakdown: (key: string) => { label: string; name?: string; hint?: string };
  entryHref: (row: EntryRow) => string;
  breakdownHref: (key: string) => string;
}) => {
  if (summary.total === 0) {
    return (
      <Box>
        <Typography color="text.secondary" paragraph>
          No active deployments in {label}.
        </Typography>
        {summary.breakdownRows.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Configured {spec.otherLabel.toLowerCase()}:{' '}
            {summary.breakdownRows.map((row) => describeBreakdown(row.key).label).join(', ')}
          </Typography>
        )}
      </Box>
    );
  }
  const maxEntry = summary.entryRows[0]?.count ?? 0;

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Metric label="Deployments" value={summary.total} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Metric label={spec.otherLabel} value={spec.otherCount(summary)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Metric label="Modules in use" value={summary.modules} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Metric label="Stacks in use" value={summary.stacks} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Metric
            label="Failing"
            value={summary.failing}
            tone={countTone(summary.failing, 'error')}
            hint="Deployments whose last run failed or recorded an error."
          />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3, alignItems: 'center' }}>
        {summary.statuses.map(({ status, count }) => (
          <StatusChip
            key={status}
            tone={statusTone(status)}
            label={`${status}: ${count}`}
            title={`${count} deployment(s) with status ${status}`}
          />
        ))}
        {summary.drifted > 0 && (
          <StatusChip
            tone="warning"
            label={`drifted: ${summary.drifted}`}
            title="Deployments whose real infrastructure no longer matches their configuration"
          />
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <Typography variant="h6" gutterBottom>
            Modules and stacks
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: TABLE_MAX_HEIGHT }}>
            <Table size="small" stickyHeader aria-label={`Modules and stacks in ${label}`}>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell sx={{ width: '30%' }}>Deployments</TableCell>
                  <TableCell align="right">Failing</TableCell>
                  <TableCell align="right">{spec.otherLabel}</TableCell>
                  <TableCell align="right">Versions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.entryRows.map((row) => (
                  <TableRow key={`${row.kind}:${row.name}`} hover>
                    <TableCell component="th" scope="row">
                      <UsageLink to={entryHref(row)}>{row.name}</UsageLink>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={row.kind} />
                    </TableCell>
                    <TableCell>
                      <CountBar
                        count={row.count}
                        max={maxEntry}
                        label={`${row.name}: ${row.count} deployments`}
                      />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: row.failing > 0 ? 'error.main' : undefined }}
                    >
                      {row.failing}
                    </TableCell>
                    <TableCell align="right">{spec.otherCount(row)}</TableCell>
                    <TableCell align="right">{row.versions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        <Grid size={{ xs: 12, xl: 5 }}>
          <Typography variant="h6" gutterBottom>
            {spec.otherLabel}
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: TABLE_MAX_HEIGHT }}>
            <Table size="small" stickyHeader aria-label={`${spec.otherLabel} in ${label}`}>
              <TableHead>
                <TableRow>
                  <TableCell>{spec.otherLabel === 'Regions' ? 'Region' : 'Account'}</TableCell>
                  <TableCell align="right">Deployments</TableCell>
                  <TableCell align="right">Failing</TableCell>
                  <TableCell align="right">Modules & stacks</TableCell>
                  <TableCell align="right">Last activity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.breakdownRows.map((row) => {
                  const described = describeBreakdown(row.key);
                  return (
                    <TableRow key={row.key} hover>
                      <TableCell component="th" scope="row">
                        <Tooltip
                          title={described.hint ?? ''}
                          disableHoverListener={!described.hint}
                        >
                          <span>
                            <Named
                              value={
                                <UsageLink to={breakdownHref(row.key)}>{described.label}</UsageLink>
                              }
                              name={described.name}
                            />
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">{row.count}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: row.failing > 0 ? 'error.main' : undefined }}
                      >
                        {row.failing}
                      </TableCell>
                      <TableCell align="right">{row.entries}</TableCell>
                      <TableCell align="right">{formatLastActivity(row.lastActivity)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Box>
  );
};

export const BreakdownView = ({ by, onBack }: { by: BreakdownDimension; onBack: () => void }) => {
  const fleet = useFleetDeployments();
  const { projectNames, projectRegions } = fleet;
  const spec = DIMENSIONS[by];
  // The page's own key is the selection; the other two filter the whole page.
  const { context, set } = useUsageContext();
  const selected = context[by] ?? '';
  const setSelected = (key: string) => set(by, key || undefined);
  const overviewRef = React.useRef<HTMLDivElement>(null);

  const stackNames = React.useMemo(
    () => new Set(fleet.stackCatalogue.map(moduleName)),
    [fleet.stackCatalogue],
  );
  const isStack = React.useCallback(
    (d: Deployment) => isStackDeployment(d, stackNames),
    [stackNames],
  );
  // A link without a kind takes it from the name's deployments, else from the registry.
  const moduleKind = React.useMemo((): ModuleKind | undefined => {
    if (!context.module || context.kind) return context.kind;
    const deployment = fleet.deployments.find((d) => d.module === context.module);
    const stack = deployment ? isStack(deployment) : stackNames.has(context.module);
    return stack ? 'stack' : 'module';
  }, [context.module, context.kind, fleet.deployments, isStack, stackNames]);
  const filters = React.useMemo<UsageContext>(
    () =>
      by === 'region'
        ? { module: context.module, kind: moduleKind, account: context.account }
        : { module: context.module, kind: moduleKind, region: context.region },
    [by, context.module, moduleKind, context.account, context.region],
  );
  const filtered = React.useMemo(
    () => fleet.deployments.filter((d) => matchesFilters(d, filters, isStack)),
    [fleet.deployments, filters, isStack],
  );

  const describeRegion = (region: string) => ({ label: region, name: regionName(region) });
  const describeAccount = (projectId: string) => {
    const name = projectNames[projectId];
    return name && name !== projectId
      ? { label: name, name: projectId, hint: projectId }
      : { label: projectId };
  };
  const describe = by === 'region' ? describeRegion : describeAccount;
  const describeBreakdown = by === 'region' ? describeAccount : describeRegion;

  // Configured groups, narrowed by the filters, so groups with no deployments still get a row.
  const configured = React.useMemo(() => {
    if (by === 'region') {
      return filters.account ? projectRegions[filters.account] ?? [] : fleet.regions;
    }
    const accounts = Object.keys(projectNames);
    return filters.region
      ? accounts.filter((id) => (projectRegions[id] ?? []).includes(filters.region!))
      : accounts;
  }, [by, filters, fleet.regions, projectNames, projectRegions]);
  const rows = React.useMemo(
    () => summarizeGroups(filtered, spec.groupOf, configured, isStack),
    [filtered, spec, configured, isStack],
  );
  const summary = React.useMemo(() => {
    if (!selected) return null;
    const inGroup = filtered.filter((d) => spec.groupOf(d) === selected);
    // An account's configured regions get a row even when nothing runs in them.
    const accountRegions = by === 'account' ? projectRegions[selected] ?? [] : [];
    const configuredBreakdown = filters.region
      ? accountRegions.filter((region) => region === filters.region)
      : accountRegions;
    return summarizeGroup(inGroup, isStack, spec.breakdownOf, configuredBreakdown);
  }, [filtered, selected, spec, by, projectRegions, filters.region, isStack]);

  // Links carry the selection and the page's filters along.
  // The module and stack pages each show one kind, so links to them need none.
  const entryHref = (row: EntryRow) =>
    usageHref(row.kind === 'stack' ? 'stack-usage' : 'module-usage', {
      ...filters,
      kind: undefined,
      module: row.name,
      [by]: selected,
    });
  const breakdownHref = (key: string) => {
    const { module, kind } = filters;
    return by === 'region'
      ? usageHref('account-usage', { module, kind, account: key, region: selected })
      : usageHref('region-usage', { module, kind, region: key, account: selected });
  };

  // The overview is below the ranking, so scroll to it after a pick.
  const selectFromRanking = (key: string) => {
    setSelected(key);
    scrollToSection(overviewRef);
  };
  useScrollToOpenedSelection(selected, fleet.fetchedAt > 0 && fleet.accessKnown, () =>
    scrollToSection(overviewRef),
  );
  const filtering = Boolean(filters.module || filters.region || filters.account);

  const optionLabel = (key: string) => {
    const { label, name } = describe(key);
    return name ? `${label} (${name})` : label;
  };

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
          scope={filtering ? { deployments: filtered, noun: 'deployment' } : undefined}
        >
          <ContextFilters
            filters={filters}
            projectNames={projectNames}
            onClear={(key) => set(key, undefined)}
          />
          <Card variant="outlined" sx={{ width: '100%', mb: 3 }}>
            <CardHeader
              title={spec.title}
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            />
            <CardContent>
              <Typography variant="body1" paragraph>
                {spec.description}
              </Typography>
              <GroupRanking
                spec={spec}
                rows={rows}
                selected={selected}
                onSelect={selectFromRanking}
                describe={describe}
              />
            </CardContent>
          </Card>

          <Card ref={overviewRef} variant="outlined" sx={{ width: '100%', mb: 3 }}>
            <CardHeader
              title={spec.overviewTitle}
              subheader={filterSummary(filters, projectNames)}
              titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            />
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, mb: selected ? 3 : 0 }}>
                <Autocomplete
                  // The page's own selection from a link is offered even when nothing runs there.
                  options={
                    selected && !rows.some((row) => row.key === selected)
                      ? [...rows.map((row) => row.key), selected]
                      : rows.map((row) => row.key)
                  }
                  getOptionLabel={optionLabel}
                  value={selected || null}
                  onChange={(_, value) => setSelected(value ?? '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={`Select ${spec.noun === 'region' ? 'Region' : 'Account'}`}
                      variant="outlined"
                    />
                  )}
                  sx={{ width: 360 }}
                />
              </Box>
              {selected && summary && (
                <GroupOverview
                  spec={spec}
                  label={describe(selected).label}
                  summary={summary}
                  describeBreakdown={describeBreakdown}
                  entryHref={entryHref}
                  breakdownHref={breakdownHref}
                />
              )}
            </CardContent>
          </Card>
        </FleetGate>
      </Grid>
    </Grid>
  );
};
