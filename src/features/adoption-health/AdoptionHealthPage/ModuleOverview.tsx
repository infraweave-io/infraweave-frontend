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

const summarize = (deployments: Deployment[]): Summary => {
  const byVersion = new Map<
    string,
    VersionRow & { accountIds: Set<string>; regionIds: Set<string> }
  >();
  const byAccount = new Map<string, AccountRow & { versionSet: Set<string> }>();
  const byStatus = new Map<string, number>();
  const regions = new Set<string>();

  let failing = 0;
  let drifted = 0;
  let newestActivity = -Infinity;
  let newestActivityVersion: string | undefined;

  for (const deployment of deployments) {
    const version = deployment.module_version || UNVERSIONED;
    const account = deployment.project_id || UNVERSIONED;
    const epoch = deployment.epoch ?? 0;
    const failed = isFailedDeployment(deployment);
    const hasDrifted = deployment.has_drifted === true;

    if (deployment.region) regions.add(deployment.region);
    if (failed) failing += 1;
    if (hasDrifted) drifted += 1;
    if (epoch > newestActivity) {
      newestActivity = epoch;
      newestActivityVersion = version;
    }

    const status = deployment.status || UNVERSIONED;
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);

    const versionRow = byVersion.get(version) ?? {
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
    versionRow.count += 1;
    versionRow.accountIds.add(account);
    if (deployment.region) versionRow.regionIds.add(deployment.region);
    if (failed) versionRow.failing += 1;
    if (hasDrifted) versionRow.drifted += 1;
    versionRow.lastActivity = Math.max(versionRow.lastActivity, epoch);
    byVersion.set(version, versionRow);

    const accountRow = byAccount.get(account) ?? {
      projectId: account,
      count: 0,
      versions: [],
      failing: 0,
      drifted: 0,
      lastActivity: 0,
      versionSet: new Set<string>(),
    };
    accountRow.count += 1;
    accountRow.versionSet.add(version);
    if (failed) accountRow.failing += 1;
    if (hasDrifted) accountRow.drifted += 1;
    accountRow.lastActivity = Math.max(accountRow.lastActivity, epoch);
    byAccount.set(account, accountRow);
  }

  const versionRows = Array.from(byVersion.values())
    .map(({ accountIds, regionIds, ...row }) => ({
      ...row,
      accounts: accountIds.size,
      regions: regionIds.size,
    }))
    .sort((a, b) => b.count - a.count || a.version.localeCompare(b.version));

  const accountRows = Array.from(byAccount.values())
    .map(({ versionSet, ...row }) => ({ ...row, versions: Array.from(versionSet).sort() }))
    .sort((a, b) => b.count - a.count || a.projectId.localeCompare(b.projectId));

  return {
    total: deployments.length,
    accounts: byAccount.size,
    regions: regions.size,
    failing,
    drifted,
    statuses: Array.from(byStatus.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    versionRows,
    accountRows,
    newestActivityVersion,
  };
};

export type ModuleOverviewProps = {
  /** Rows for one module or stack, across every account and region the caller can see. */
  deployments: Deployment[];
  /** What the rows are deployments of, for the wording. */
  kind?: 'module' | 'stack';
  /** Account display names by project id. Ids are shown for anything missing. */
  projectNames?: Record<string, string>;
  /** Opens the deployment list for one version, when the page offers that drill-in. */
  onVersionClick?: (version: string) => void;
};

export const ModuleOverview = ({
  deployments,
  kind = 'module',
  projectNames = {},
  onVersionClick,
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
                        <span>{projectNames[row.projectId] ?? row.projectId}</span>
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
