import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  Link,
  Typography,
} from '@mui/material';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_AggregationFn,
  type MRT_ColumnDef,
} from 'material-react-table';
import type { StackModuleUsage } from '../../../types/Deployment';
import { Link as RouterLink } from 'react-router-dom';
import { deploymentKey, moduleVersionLink, stackVersionLink } from './deploymentViewUtils';
import { useThemedTableOptions } from './useThemedTableOptions';
import { DeploymentsDialog } from '../../modules/detail/ModuleVersions';
import { matchesFilters } from './usageContext';
import type { UsageContext } from './usageContext';
import {
  groupModuleStackUses,
  type ModuleStackRelationship,
} from './moduleStackUsageRelationships';

type ModuleStackUsageTableRow = ModuleStackRelationship & {
  deploymentCount: number;
  accountCount: number;
  regionCount: number;
};

export type ModuleStackUsageTableCardProps = {
  uses: StackModuleUsage[];
  selectedModuleName: string;
  filters: Pick<UsageContext, 'account' | 'region'>;
  loading: boolean;
  incomplete: boolean;
};

const distinctLeafCount =
  (keyFor: (usage: StackModuleUsage) => string): MRT_AggregationFn<ModuleStackUsageTableRow> =>
  (_columnId, leafRows) =>
    new Set(leafRows.flatMap((row) => row.original.deployments.map(keyFor))).size;

const deploymentCountAggregation = distinctLeafCount(deploymentKey);
const accountCountAggregation = distinctLeafCount((usage) => usage.project_id);
const regionCountAggregation = distinctLeafCount((usage) => usage.region);

const ModuleVersionLink = ({ relationship }: { relationship: ModuleStackRelationship }) => (
  <Link
    component={RouterLink}
    to={moduleVersionLink(
      relationship.moduleName,
      relationship.moduleVersion,
      relationship.moduleTrack,
    )}
    aria-label={`View module ${relationship.moduleName} version ${relationship.moduleVersion}`}
  >
    {relationship.moduleVersion}
  </Link>
);

/** Shows version-pinned module relationships contained in deployed stacks. */
export const ModuleStackUsageTableCard = ({
  uses,
  selectedModuleName,
  filters,
  loading,
  incomplete,
}: ModuleStackUsageTableCardProps) => {
  const [selectedRelationship, setSelectedRelationship] = useState<ModuleStackRelationship | null>(
    null,
  );

  const data = useMemo(() => {
    const moduleUses = uses.filter((usage) => usage.module === selectedModuleName);
    const rows: ModuleStackUsageTableRow[] = [];
    for (const relationship of groupModuleStackUses(moduleUses)) {
      const deployments = relationship.deployments.filter((usage) =>
        matchesFilters(usage, filters),
      );
      if (deployments.length === 0) continue;
      rows.push({
        ...relationship,
        deployments,
        deploymentCount: new Set(deployments.map(deploymentKey)).size,
        accountCount: new Set(deployments.map((usage) => usage.project_id)).size,
        regionCount: new Set(deployments.map((usage) => usage.region)).size,
      });
    }
    return rows;
  }, [uses, filters, selectedModuleName]);

  const columns = useMemo<MRT_ColumnDef<ModuleStackUsageTableRow>[]>(
    () => [
      {
        accessorKey: 'moduleVersion',
        header: 'Module version',
        Cell: ({ row }) => <ModuleVersionLink relationship={row.original} />,
        GroupedCell: ({ row }) => (
          <>
            <ModuleVersionLink relationship={row.getLeafRows()[0].original} /> ({row.subRows.length}
            )
          </>
        ),
      },
      { accessorKey: 'stackName', header: 'Stack' },
      {
        accessorKey: 'stackVersion',
        header: 'Stack version',
        Cell: ({ row }) => (
          <Link
            component={RouterLink}
            to={stackVersionLink(
              row.original.stackName,
              row.original.stackVersion,
              row.original.stackTrack,
            )}
            aria-label={`View stack ${row.original.stackName} version ${row.original.stackVersion}`}
          >
            {row.original.stackVersion}
          </Link>
        ),
      },
      {
        accessorKey: 'deploymentCount',
        header: 'Deployments',
        aggregationFn: deploymentCountAggregation,
        AggregatedCell: ({ cell }) => (
          <Typography
            component="span"
            aria-label={`Distinct deployments: ${cell.getValue<number>()}`}
          >
            {cell.getValue<number>()}
          </Typography>
        ),
        Cell: ({ row }) => (
          <Button
            size="small"
            onClick={() => setSelectedRelationship(row.original)}
            aria-label={`View deployments for module ${row.original.moduleName} version ${row.original.moduleVersion} in stack ${row.original.stackName} version ${row.original.stackVersion}`}
          >
            {row.original.deploymentCount}
          </Button>
        ),
      },
      {
        accessorKey: 'accountCount',
        header: 'Accounts',
        aggregationFn: accountCountAggregation,
        AggregatedCell: ({ cell }) => (
          <Typography component="span" aria-label={`Distinct accounts: ${cell.getValue<number>()}`}>
            {cell.getValue<number>()}
          </Typography>
        ),
      },
      {
        accessorKey: 'regionCount',
        header: 'Regions',
        aggregationFn: regionCountAggregation,
        AggregatedCell: ({ cell }) => (
          <Typography component="span" aria-label={`Distinct regions: ${cell.getValue<number>()}`}>
            {cell.getValue<number>()}
          </Typography>
        ),
      },
    ],
    [],
  );

  const themedTableOptions = useThemedTableOptions<ModuleStackUsageTableRow>({
    groupingRemovable: false,
  });
  const table = useMaterialReactTable({
    ...themedTableOptions,
    columns,
    data,
    enableColumnActions: false,
    enableGrouping: true,
    enableColumnDragging: false,
    enableColumnFilters: true,
    enableGlobalFilter: true,
    enableSorting: true,
    enablePagination: false,
    enableFullScreenToggle: false,
    groupedColumnMode: 'reorder',
    initialState: {
      grouping: ['moduleVersion', 'stackName'],
      columnVisibility: { deploymentCount: false, accountCount: false, regionCount: false },
      expanded: {},
      showColumnFilters: false,
      showGlobalFilter: true,
      sorting: [],
      density: 'compact',
    },
  });

  return (
    <Card variant="outlined" sx={{ width: '100%', mt: 3 }}>
      <CardHeader
        title="Module versions in deployed stacks"
        titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      />
      <CardContent>
        {incomplete && (
          <Alert severity="warning" role="status" sx={{ mb: 2 }}>
            Some relationship data could not be fully loaded, so this table may be incomplete.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Expand a module version to see its stacks and deployed stack versions.
        </Typography>
        {loading && <LinearProgress aria-label="Loading deployed stack relationships" />}
        {!loading && data.length === 0 && (
          <Typography color="text.secondary">
            {`No deployed stack relationships for ${selectedModuleName} match the current filters.`}
          </Typography>
        )}
        {!loading && data.length > 0 && (
          <Box sx={{ minWidth: 0 }}>
            <MaterialReactTable table={table} />
          </Box>
        )}
      </CardContent>
      {selectedRelationship && (
        <DeploymentsDialog
          open
          onClose={() => setSelectedRelationship(null)}
          moduleName={selectedRelationship.moduleName}
          version={selectedRelationship.moduleVersion}
          stackModuleDeployments={selectedRelationship.deployments}
          includeDirectDeployments={false}
          initialProjectIds={filters.account ? [filters.account] : undefined}
          initialRegions={filters.region ? [filters.region] : undefined}
          initialParentStack={selectedRelationship}
          rowLabel="Deployments"
        />
      )}
    </Card>
  );
};
