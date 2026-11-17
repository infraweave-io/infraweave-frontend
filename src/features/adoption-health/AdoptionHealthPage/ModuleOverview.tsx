import React from 'react';
import {
  Box,
  Grid,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { Deployment } from '../../../types/Deployment';
import { isFailedDeployment } from '../../../utils/deploymentStatus';
import { shortenVersion } from '../../../utils/version';
import { StatusChip } from '../../../shared/components/StatusChip';
import {
  countTone,
  formatLastActivity,
  Metric,
  statusTone,
  TABLE_MAX_HEIGHT,
} from './OverviewParts';
import { UsageLink } from './usageContext';

type VersionRow = {
  version: string;
  count: number;
  accounts: number;
  regions: number;
  failing: number;
  drifted: number;
  lastActivity: number;
};

type AccountRow = {
  projectId: string;
  count: number;
  versions: string[];
  failing: number;
  drifted: number;
  lastActivity: number;
};

type Summary = {
  total: number;
  accounts: number;
  regions: number;
  failing: number;
  drifted: number;
  statuses: { status: string; count: number }[];
  versionRows: VersionRow[];
  accountRows: AccountRow[];
  /** Version deployed most recently. Not the highest, which would need pre-release semver rules. */
  newestActivityVersion?: string;
};

const UNVERSIONED = 'unknown';

type VersionAccumulator = VersionRow & { accountIds: Set<string>; regionIds: Set<string> };
type AccountAccumulator = AccountRow & { versionSet: Set<string> };

type OverviewAccumulator = {
  byVersion: Map<string, VersionAccumulator>;
  byAccount: Map<string, AccountAccumulator>;
  byStatus: Map<string, number>;
  regions: Set<string>;
  failing: number;
  drifted: number;
  newestActivity: number;
  newestActivityVersion?: string;
};

const addVersionDeployment = (
  rows: Map<string, VersionAccumulator>,
  deployment: Deployment,
  version: string,
  account: string,
  failed: boolean,
  drifted: boolean,
  epoch: number,
) => {
  let row = rows.get(version);
  if (!row) {
    row = {
      version,
      count: 0,
      accounts: 0,
      regions: 0,
      failing: 0,
      drifted: 0,
      lastActivity: 0,
      accountIds: new Set<string>(),
      regionIds: new Set<string>(),
    };
  }

  row.count += 1;
  row.accountIds.add(account);
  if (deployment.region) row.regionIds.add(deployment.region);
  if (failed) row.failing += 1;
  if (drifted) row.drifted += 1;
  row.lastActivity = Math.max(row.lastActivity, epoch);
  rows.set(version, row);
};

const addAccountDeployment = (
  rows: Map<string, AccountAccumulator>,
  account: string,
  version: string,
  failed: boolean,
  drifted: boolean,
  epoch: number,
) => {
  let row = rows.get(account);
  if (!row) {
    row = {
      projectId: account,
      count: 0,
      versions: [],
      failing: 0,
      drifted: 0,
      lastActivity: 0,
      versionSet: new Set<string>(),
    };
  }

  row.count += 1;
  row.versionSet.add(version);
  if (failed) row.failing += 1;
  if (drifted) row.drifted += 1;
  row.lastActivity = Math.max(row.lastActivity, epoch);
  rows.set(account, row);
};

const addOverviewCounts = (
  summary: OverviewAccumulator,
  deployment: Deployment,
  failed: boolean,
  drifted: boolean,
) => {
  if (deployment.region) summary.regions.add(deployment.region);
  if (failed) summary.failing += 1;
  if (drifted) summary.drifted += 1;
};

const updateNewestActivity = (summary: OverviewAccumulator, epoch: number, version: string) => {
  if (epoch > summary.newestActivity) {
    summary.newestActivity = epoch;
    summary.newestActivityVersion = version;
  }
};

const addDeploymentToOverview = (summary: OverviewAccumulator, deployment: Deployment) => {
  const version = deployment.module_version || UNVERSIONED;
  const account = deployment.project_id || UNVERSIONED;
  const epoch = deployment.epoch ?? 0;
  const failed = isFailedDeployment(deployment);
  const drifted = deployment.has_drifted === true;

  addOverviewCounts(summary, deployment, failed, drifted);
  updateNewestActivity(summary, epoch, version);

  const status = deployment.status || UNVERSIONED;
  summary.byStatus.set(status, (summary.byStatus.get(status) ?? 0) + 1);
  addVersionDeployment(summary.byVersion, deployment, version, account, failed, drifted, epoch);
  addAccountDeployment(summary.byAccount, account, version, failed, drifted, epoch);
};

const summarize = (deployments: Deployment[]): Summary => {
  const summary: OverviewAccumulator = {
    byVersion: new Map(),
    byAccount: new Map(),
    byStatus: new Map(),
    regions: new Set(),
    failing: 0,
    drifted: 0,
    newestActivity: -Infinity,
  };

  for (const deployment of deployments) addDeploymentToOverview(summary, deployment);

  const versionRows = Array.from(summary.byVersion.values())
    .map(({ accountIds, regionIds, ...row }) => ({
      ...row,
      accounts: accountIds.size,
      regions: regionIds.size,
    }))
    .sort((a, b) => b.count - a.count || a.version.localeCompare(b.version));

  const accountRows = Array.from(summary.byAccount.values())
    .map(({ versionSet, ...row }) => ({ ...row, versions: Array.from(versionSet).sort() }))
    .sort((a, b) => b.count - a.count || a.projectId.localeCompare(b.projectId));

  return {
    total: deployments.length,
    accounts: summary.byAccount.size,
    regions: summary.regions.size,
    failing: summary.failing,
    drifted: summary.drifted,
    statuses: Array.from(summary.byStatus.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    versionRows,
    accountRows,
    newestActivityVersion: summary.newestActivityVersion,
  };
};

export type ModuleOverviewProps = {
  /** Rows for one module or stack, in the accounts and regions the page is showing. */
  deployments: Deployment[];
  /** What the rows are deployments of, for the wording. */
  kind?: 'module' | 'stack';
  /** Account display names by project id. Ids are shown for anything missing. */
  projectNames?: Record<string, string>;
  /** Opens the deployment list for one version, when the page offers that drill-in. */
  onVersionClick?: (version: string) => void;
  /** Where an account's name leads, when the page offers that drill-down. */
  accountHref?: (projectId: string) => string;
};

export const ModuleOverview = ({
  deployments,
  kind = 'module',
  projectNames = {},
  onVersionClick,
  accountHref,
}: ModuleOverviewProps) => {
  const summary = React.useMemo(() => summarize(deployments), [deployments]);

  if (summary.total === 0) {
    return (
      <Typography color="text.secondary">No active deployments found for this {kind}.</Typography>
    );
  }

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Metric label="Deployments" value={summary.total} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Metric label="Accounts" value={summary.accounts} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Metric label="Regions" value={summary.regions} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <Metric
            label="Versions in use"
            value={summary.versionRows.length}
            hint="How fragmented the fleet is: one version means everyone is on the same code."
          />
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
            Version adoption
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: TABLE_MAX_HEIGHT }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Version</TableCell>
                  <TableCell>Share</TableCell>
                  <TableCell align="right">Deployments</TableCell>
                  <TableCell align="right">Failing</TableCell>
                  <TableCell align="right">Accounts</TableCell>
                  <TableCell align="right">Regions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.versionRows.map((row) => (
                  <TableRow key={row.version} hover>
                    <TableCell component="th" scope="row">
                      <Tooltip title={row.version}>
                        {onVersionClick ? (
                          <MuiLink
                            component="button"
                            variant="body2"
                            underline="hover"
                            onClick={() => onVersionClick(row.version)}
                          >
                            {shortenVersion(row.version)}
                          </MuiLink>
                        ) : (
                          <span>{shortenVersion(row.version)}</span>
                        )}
                      </Tooltip>
                      {row.version === summary.newestActivityVersion && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          deployed last
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ width: '25%' }}>
                      <LinearProgress
                        variant="determinate"
                        value={(row.count / summary.total) * 100}
                        aria-label={`${row.version} share`}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </TableCell>
                    <TableCell align="right">{row.count}</TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: row.failing > 0 ? 'error.main' : undefined }}
                    >
                      {row.failing}
                    </TableCell>
                    <TableCell align="right">{row.accounts}</TableCell>
                    <TableCell align="right">{row.regions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>

        <Grid size={{ xs: 12, xl: 5 }}>
          <Typography variant="h6" gutterBottom>
            Accounts
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: TABLE_MAX_HEIGHT }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell align="right">Deployments</TableCell>
                  <TableCell align="right">Failing</TableCell>
                  <TableCell align="right">Versions</TableCell>
                  <TableCell align="right">Last activity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.accountRows.map((row) => (
                  <TableRow key={row.projectId} hover>
                    <TableCell component="th" scope="row">
                      <Tooltip title={row.projectId}>
                        <span>
                          {accountHref ? (
                            <UsageLink to={accountHref(row.projectId)}>
                              {projectNames[row.projectId] ?? row.projectId}
                            </UsageLink>
                          ) : (
                            projectNames[row.projectId] ?? row.projectId
                          )}
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
                    <TableCell align="right">
                      <Tooltip title={row.versions.join(', ')}>
                        <span>{row.versions.length}</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">{formatLastActivity(row.lastActivity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    </Box>
  );
};
