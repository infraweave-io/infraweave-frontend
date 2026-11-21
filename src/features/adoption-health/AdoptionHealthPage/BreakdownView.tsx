import React from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  FramedTableContainer,
  ResponseErrorPanel,
} from '../../../standalone/components/ComponentAdapter';
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
import { useStackModuleUsage, type StackModuleUsageState } from './stackModuleUsage';
import {
  ContextFilters,
  COUNT_NOUN,
  DEFAULT_MODULE_USAGE_MODE,
  filterSummary,
  matchesFilters,
  StackUsageIncompleteChip,
  usageHref,
  UsageLink,
  useScrollToOpenedSelection,
  useUsageContext,
} from './usageContext';
import type { ContextKey, CountNoun, UsageKind, UsageContext } from './usageContext';

/** Region and account usage pages, one view over the cached fleet. */

export type BreakdownDimension = 'region' | 'account';

/** `breakdownOf` and `other*` refer to the dimension each group splits into. */
type GroupDescription = { label: string; name?: string; hint?: string };

/** Each dimension supplies labels for its groups and nested breakdown. */
type DimensionSpec = {
  noun: string;
  title: (countNoun: CountNoun) => string;
  description: (countNoun: CountNoun) => string;
  overviewTitle: string;
  groupOf: GroupOf;
  breakdownOf: GroupOf;
  otherLabel: string;
  otherCount: (row: { accounts: number; regions: number }) => number;
  describe: (key: string, projectNames: Record<string, string>) => GroupDescription;
  describeBreakdown: (key: string, projectNames: Record<string, string>) => GroupDescription;
};

const describeRegion = (key: string): GroupDescription => ({ label: key, name: regionName(key) });
const describeAccount = (
  projectId: string,
  projectNames: Record<string, string>,
): GroupDescription => {
  const name = projectNames[projectId];
  return name && name !== projectId
    ? { label: name, name: projectId, hint: projectId }
    : { label: projectId };
};

const DIMENSIONS: Record<BreakdownDimension, DimensionSpec> = {
  region: {
    noun: 'region',
    title: (countNoun) => `${countNoun.label} by region`,
    description: (countNoun) =>
      `Regions your accounts deploy to, ranked by active ${countNoun.plural}. Select one to see its modules, stacks and accounts.`,
    overviewTitle: 'Region Overview',
    groupOf: byRegion,
    breakdownOf: byAccount,
    otherLabel: 'Accounts',
    otherCount: (row) => row.accounts,
    describe: (key) => describeRegion(key),
    describeBreakdown: (key, projectNames) => describeAccount(key, projectNames),
  },
  account: {
    noun: 'account',
    title: (countNoun) => `${countNoun.label} by account`,
    description: (countNoun) =>
      `Accounts you can see, ranked by active ${countNoun.plural}. Select one to see its modules, stacks, versions and regions.`,
    overviewTitle: 'Account Overview',
    groupOf: byAccount,
    breakdownOf: byRegion,
    otherLabel: 'Regions',
    otherCount: (row) => row.regions,
    describe: (key, projectNames) => describeAccount(key, projectNames),
    describeBreakdown: (key) => describeRegion(key),
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
  countNoun,
}: {
  spec: DimensionSpec;
  rows: GroupRow[];
  selected: string;
  onSelect: (key: string) => void;
  describe: (key: string) => { label: string; name?: string };
  countNoun: CountNoun;
}) => {
  if (rows.length === 0) {
    return <Typography color="text.secondary">No {spec.noun}s found.</Typography>;
  }
  const inUse = rows.filter((row) => row.count > 0).length;
  const max = rows[0]?.count ?? 0;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {inUse} of {rows.length} {spec.noun}s have active {countNoun.plural}.
      </Typography>
      <FramedTableContainer maxHeight={TABLE_MAX_HEIGHT}>
        <Table
          size="small"
          stickyHeader
          aria-label={`${spec.noun}s by number of ${countNoun.plural}`}
        >
          <TableHead>
            <TableRow>
              <TableCell>{spec.noun === 'region' ? 'Region' : 'Account'}</TableCell>
              <TableCell sx={{ width: '30%' }}>{countNoun.label}</TableCell>
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
                      label={`${label}: ${row.count} ${countNoun.plural}`}
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
      </FramedTableContainer>
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
  countNoun,
}: {
  spec: DimensionSpec;
  label: string;
  summary: GroupSummary;
  describeBreakdown: (key: string) => { label: string; name?: string; hint?: string };
  entryHref: (row: EntryRow) => string;
  breakdownHref: (key: string) => string;
  countNoun: CountNoun;
}) => {
  if (summary.total === 0) {
    return (
      <Box>
        <Typography color="text.secondary" paragraph>
          No active {countNoun.plural} in {label}.
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
          <Metric label={countNoun.label} value={summary.total} />
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
            hint={`${countNoun.label} whose last run failed or recorded an error.`}
          />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3, alignItems: 'center' }}>
        {summary.statuses.map(({ status, count }) => (
          <StatusChip
            key={status}
            tone={statusTone(status)}
            label={`${status}: ${count}`}
            title={`${count} ${
              count === 1 ? countNoun.singular : countNoun.plural
            } with status ${status}`}
          />
        ))}
        {summary.drifted > 0 && (
          <StatusChip
            tone="warning"
            label={`drifted: ${summary.drifted}`}
            title={`${countNoun.label} whose real infrastructure no longer matches their configuration`}
          />
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <Typography variant="h6" gutterBottom>
            Modules and stacks
          </Typography>
          <FramedTableContainer maxHeight={TABLE_MAX_HEIGHT}>
            <Table size="small" stickyHeader aria-label={`Modules and stacks in ${label}`}>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell sx={{ width: '30%' }}>{countNoun.label}</TableCell>
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
                        label={`${row.name}: ${row.count} ${countNoun.plural}`}
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
          </FramedTableContainer>
        </Grid>

        <Grid size={{ xs: 12, xl: 5 }}>
          <Typography variant="h6" gutterBottom>
            {spec.otherLabel}
          </Typography>
          <FramedTableContainer maxHeight={TABLE_MAX_HEIGHT}>
            <Table size="small" stickyHeader aria-label={`${spec.otherLabel} in ${label}`}>
              <TableHead>
                <TableRow>
                  <TableCell>{spec.otherLabel === 'Regions' ? 'Region' : 'Account'}</TableCell>
                  <TableCell align="right">{countNoun.label}</TableCell>
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
          </FramedTableContainer>
        </Grid>
      </Grid>
    </Box>
  );
};

const selectionOptions = (rows: GroupRow[], selected: string): string[] => {
  const options = rows.map((row) => row.key);
  return selected && !options.includes(selected) ? [...options, selected] : options;
};

const BreakdownContent = ({
  fleet,
  onBack,
  spec,
  projectNames,
  filters,
  stackModuleUsage,
  set,
  filtered,
  filtering,
  selected,
  setSelected,
  overviewRef,
  rows,
  selectFromRanking,
  optionLabel,
  summary,
  describe,
  describeBreakdown,
  entryHref,
  breakdownHref,
  countNoun,
}: {
  fleet: ReturnType<typeof useFleetDeployments>;
  onBack: () => void;
  spec: DimensionSpec;
  projectNames: Record<string, string>;
  filters: UsageContext;
  stackModuleUsage: StackModuleUsageState;
  set: (key: ContextKey, value: string | undefined) => void;
  filtered: Deployment[];
  filtering: boolean;
  selected: string;
  setSelected: (key: string) => void;
  overviewRef: React.Ref<HTMLDivElement>;
  rows: GroupRow[];
  selectFromRanking: (key: string) => void;
  optionLabel: (key: string) => string;
  summary: GroupSummary | null;
  describe: (key: string) => GroupDescription;
  describeBreakdown: (key: string) => GroupDescription;
  entryHref: (row: EntryRow) => string;
  breakdownHref: (key: string) => string;
  countNoun: CountNoun;
}) => (
  <Grid container spacing={3}>
    <Grid size={12}>
      <Box mb={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
          Back to Dashboard
        </Button>
      </Box>
      <FleetGate
        fleet={fleet}
        scope={
          filtering && !stackModuleUsage.loading
            ? { deployments: filtered, noun: countNoun }
            : undefined
        }
      >
        <ContextFilters
          filters={filters}
          projectNames={projectNames}
          onClear={(key) => set(key, undefined)}
        />
        <Card variant="outlined" sx={{ width: '100%', mb: 3 }}>
          <CardHeader
            title={spec.title(countNoun)}
            titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          />
          <CardContent>
            <Typography variant="body1" paragraph>
              {spec.description(countNoun)}
            </Typography>
            {filters.module &&
              filters.kind === 'module' &&
              filters.moduleUsageMode !== 'standalone' && (
                <>
                  {stackModuleUsage.loading && (
                    <Typography variant="body2" color="text.secondary" role="status" sx={{ mb: 2 }}>
                      Loading deployed stack compositions for this module.
                    </Typography>
                  )}
                  {stackModuleUsage.incomplete && (
                    <Alert severity="warning" role="status" sx={{ mb: 2 }}>
                      Some deployed stack compositions could not be loaded, so within-stack module
                      usage may be incomplete.
                    </Alert>
                  )}
                </>
              )}
            {!stackModuleUsage.loading && (
              <GroupRanking
                spec={spec}
                rows={rows}
                selected={selected}
                onSelect={selectFromRanking}
                describe={describe}
                countNoun={countNoun}
              />
            )}
          </CardContent>
        </Card>

        <Card ref={overviewRef} variant="outlined" sx={{ width: '100%', mb: 3 }}>
          <CardHeader
            title={spec.overviewTitle}
            subheader={filterSummary(filters, projectNames)}
            action={
              selected &&
              filters.module &&
              filters.kind === 'module' &&
              filters.moduleUsageMode !== 'standalone' &&
              stackModuleUsage.incomplete ? (
                <StackUsageIncompleteChip />
              ) : undefined
            }
            titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          />
          <CardContent>
            <Box sx={{ display: 'flex', gap: 2, mb: selected ? 3 : 0 }}>
              <Autocomplete
                // The page's own selection from a link is offered even when nothing runs there.
                options={selectionOptions(rows, selected)}
                getOptionLabel={optionLabel}
                value={selected || null}
                disabled={stackModuleUsage.loading}
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
            {!stackModuleUsage.loading && selected && summary && (
              <GroupOverview
                spec={spec}
                label={describe(selected).label}
                summary={summary}
                describeBreakdown={describeBreakdown}
                entryHref={entryHref}
                breakdownHref={breakdownHref}
                countNoun={countNoun}
              />
            )}
          </CardContent>
        </Card>
      </FleetGate>
    </Grid>
  </Grid>
);

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
  const usageKind = React.useMemo((): UsageKind | undefined => {
    if (!context.module || context.kind) return context.kind;
    const deployment = fleet.deployments.find((d) => d.module === context.module);
    const stack = deployment ? isStack(deployment) : stackNames.has(context.module);
    return stack ? 'stack' : 'module';
  }, [context.module, context.kind, fleet.deployments, isStack, stackNames]);
  const moduleUsageMode = context.moduleUsageMode ?? DEFAULT_MODULE_USAGE_MODE;
  const filters = React.useMemo<UsageContext>(
    () => ({
      ...(by === 'region'
        ? { module: context.module, kind: usageKind, account: context.account }
        : { module: context.module, kind: usageKind, region: context.region }),
      moduleUsageMode: usageKind === 'module' ? moduleUsageMode : undefined,
    }),
    [by, context.module, usageKind, context.account, context.region, moduleUsageMode],
  );
  const stackDeployments = React.useMemo(
    () => fleet.deployments.filter(isStack),
    [fleet.deployments, isStack],
  );
  const stackModuleUsage = useStackModuleUsage(
    context.module && usageKind === 'module' && moduleUsageMode !== 'standalone'
      ? stackDeployments
      : [],
  );
  const filtered = React.useMemo(() => {
    let source = fleet.deployments;
    if (filters.module && usageKind === 'module') {
      if (moduleUsageMode === 'in-stacks') {
        source = stackModuleUsage.uses;
      } else {
        const standalone = fleet.deployments.filter((deployment) => !isStack(deployment));
        source =
          moduleUsageMode === 'both' ? [...standalone, ...stackModuleUsage.uses] : standalone;
      }
    }
    return source.filter((deployment) => matchesFilters(deployment, filters, isStack));
  }, [fleet.deployments, filters, isStack, usageKind, moduleUsageMode, stackModuleUsage.uses]);
  // Only a selected module's rows come from the chosen source.
  const countNoun =
    COUNT_NOUN[filters.module && usageKind === 'module' ? moduleUsageMode : 'standalone'];

  const describe = (key: string) => spec.describe(key, projectNames);
  const describeBreakdown = (key: string) => spec.describeBreakdown(key, projectNames);

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
      moduleUsageMode: row.kind === 'module' ? filters.moduleUsageMode : undefined,
      module: row.name,
      [by]: selected,
    });
  const breakdownHref = (key: string) => {
    const { module, kind } = filters;
    const moduleUsageMode = kind === 'module' ? filters.moduleUsageMode : undefined;
    return by === 'region'
      ? usageHref('account-usage', {
          module,
          kind,
          moduleUsageMode,
          account: key,
          region: selected,
        })
      : usageHref('region-usage', {
          module,
          kind,
          moduleUsageMode,
          region: key,
          account: selected,
        });
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
    <BreakdownContent
      fleet={fleet}
      onBack={onBack}
      spec={spec}
      projectNames={projectNames}
      filters={filters}
      stackModuleUsage={stackModuleUsage}
      set={set}
      filtered={filtered}
      filtering={filtering}
      selected={selected}
      setSelected={setSelected}
      overviewRef={overviewRef}
      rows={rows}
      selectFromRanking={selectFromRanking}
      optionLabel={optionLabel}
      summary={summary}
      describe={describe}
      describeBreakdown={describeBreakdown}
      entryHref={entryHref}
      breakdownHref={breakdownHref}
      countNoun={countNoun}
    />
  );
};
