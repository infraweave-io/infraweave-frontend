import React from 'react';
import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { FramedTableContainer, Link } from '../../standalone/components/ComponentAdapter';
import { MONO_FONT } from '../../contexts/ThemeContext';
import { formatCost } from '../../utils/cost';

export interface CostTableRow {
  key: string;
  label: React.ReactNode;
  /** A second line under the label, e.g. the account a deployment is in. */
  detail?: React.ReactNode;
  amount: number;
  /** The swatch of the series the row is charted as, when it is. */
  color?: string;
  link?: string;
  /** A destroyed deployment: struck through in red, as its own page shows it. */
  deleted?: boolean;
}

const numeric = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;

/** Rows with their cost and share of `total`, as text beside a chart that draws the same. */
export const CostShareTable = ({
  heading,
  rows,
  total,
  unit,
  maxHeight = 320,
  ariaLabel,
}: {
  heading: React.ReactNode;
  rows: CostTableRow[];
  total: number;
  unit: string;
  maxHeight?: number;
  ariaLabel: string;
}) => (
  <FramedTableContainer maxHeight={maxHeight}>
    <Table size="small" stickyHeader aria-label={ariaLabel}>
      <TableHead>
        <TableRow>
          <TableCell>{heading}</TableCell>
          <TableCell align="right">Cost</TableCell>
          <TableCell align="right">Share</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key} hover>
            <TableCell>
              <Box display="flex" alignItems="center" gap={1}>
                {row.color && (
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '2px',
                      flexShrink: 0,
                      bgcolor: row.color,
                    }}
                  />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Box
                    component="span"
                    sx={
                      row.deleted
                        ? {
                            '&, & a': {
                              color: 'error.main',
                              textDecoration: 'line-through',
                            },
                          }
                        : undefined
                    }
                  >
                    {row.link ? <Link to={row.link}>{row.label}</Link> : row.label}
                  </Box>
                  {row.detail && (
                    <Typography variant="caption" color="text.secondary" component="div">
                      {row.detail}
                    </Typography>
                  )}
                </Box>
              </Box>
            </TableCell>
            <TableCell align="right" sx={numeric}>
              {formatCost(row.amount, unit)}
            </TableCell>
            <TableCell align="right" sx={{ ...numeric, color: 'text.secondary' }}>
              {total > 0 ? `${((row.amount / total) * 100).toFixed(1)}%` : '–'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </FramedTableContainer>
);

/** A resource id is usually an ARN; the part after the service is what tells resources apart. */
export const shortResourceId = (resourceId: string) => {
  const parts = resourceId.split(':');
  return parts.length >= 6 ? parts.slice(5).join(':') : resourceId;
};

export const ResourceIdLabel = ({ resourceId }: { resourceId: string }) => (
  <Box
    component="span"
    title={resourceId}
    sx={{ fontFamily: MONO_FONT, fontSize: '0.8125rem', wordBreak: 'break-all' }}
  >
    {shortResourceId(resourceId)}
  </Box>
);
