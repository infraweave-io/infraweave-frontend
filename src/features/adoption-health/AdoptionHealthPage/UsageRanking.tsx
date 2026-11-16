import React from 'react';
import {
  Box,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Deployment } from '../../../types/Deployment';
import { isFailedDeployment } from '../../../utils/deploymentStatus';

/** Max height in px before the table scrolls instead of growing the page. */
const TABLE_MAX_HEIGHT = 420;

type RankingRow = {
  name: string;
  count: number;
  accounts: number;
  versions: number;
  failing: number;
};

const rank = (deployments: Deployment[], registered: string[]): RankingRow[] => {
  const rows = new Map<string, RankingRow & { accountIds: Set<string>; versionIds: Set<string> }>();
  const rowFor = (name: string) => {
    let row = rows.get(name);
    if (!row) {
      row = {
        name,
        count: 0,
        accounts: 0,
        versions: 0,
        failing: 0,
        accountIds: new Set(),
        versionIds: new Set(),
      };
      rows.set(name, row);
    }
    return row;
  };

  for (const name of registered) rowFor(name);
  for (const d of deployments) {
    if (!d.module) continue;
    const row = rowFor(d.module);
    row.count += 1;
    if (d.project_id) row.accountIds.add(d.project_id);
    if (d.module_version) row.versionIds.add(d.module_version);
    if (isFailedDeployment(d)) row.failing += 1;
  }

  return Array.from(rows.values())
    .map(({ accountIds, versionIds, ...row }) => ({
      ...row,
      accounts: accountIds.size,
      versions: versionIds.size,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

export type UsageRankingProps = {
  kind: 'module' | 'stack';
  /** Deployments of this kind only. */
  deployments: Deployment[];
  /** Names in the registry, so unused ones get a row as well. */
  registered: string[];
  /** The registry is still loading, so the ranking would miss unused entries. */
  loading?: boolean;
  selected: string;
  onSelect: (name: string) => void;
};

export const UsageRanking = ({
  kind,
  deployments,
  registered,
  loading = false,
  selected,
  onSelect,
}: UsageRankingProps) => {
  const rows = React.useMemo(() => rank(deployments, registered), [deployments, registered]);
  const inUse = rows.filter((row) => row.count > 0).length;
  // Rows are sorted by count, so the first is the largest.
  const max = rows[0]?.count || 1;

  if (loading) {
    return <LinearProgress aria-label={`Loading the ${kind} registry`} />;
  }

  if (rows.length === 0) {
    return <Typography color="text.secondary">No {kind}s found.</Typography>;
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {inUse} of {rows.length} {kind}s have active deployments.
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: TABLE_MAX_HEIGHT }}>
        <Table size="small" stickyHeader aria-label={`${kind}s by number of deployments`}>
          <TableHead>
            <TableRow>
              <TableCell>{kind === 'stack' ? 'Stack' : 'Module'}</TableCell>
              <TableCell sx={{ width: '35%' }}>Deployments</TableCell>
              <TableCell align="right">Failing</TableCell>
              <TableCell align="right">Accounts</TableCell>
              <TableCell align="right">Versions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.name}
                hover
                selected={row.name === selected}
                onClick={() => onSelect(row.name)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell component="th" scope="row">
                  <MuiLink
                    component="button"
                    variant="body2"
                    underline="hover"
                    onClick={(event: React.MouseEvent) => {
                      // The row handles mouse clicks; the link is for keyboard access.
                      event.stopPropagation();
                      onSelect(row.name);
                    }}
                  >
                    {row.name}
                  </MuiLink>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={(row.count / max) * 100}
                      aria-label={`${row.name}: ${row.count} deployments`}
                      sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                    />
                    <Typography
                      variant="body2"
                      color={row.count > 0 ? 'text.primary' : 'text.secondary'}
                      sx={{ minWidth: 32, textAlign: 'right' }}
                    >
                      {row.count}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ color: row.failing > 0 ? 'error.main' : undefined }}>
                  {row.failing}
                </TableCell>
                <TableCell align="right">{row.accounts}</TableCell>
                <TableCell align="right">{row.versions}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
