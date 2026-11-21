import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from 'material-react-table';
import type { Deployment, StackModuleUsage } from '../../../types/Deployment';
import { DeploymentsDialog } from '../../modules/detail/ModuleVersions';
import { deploymentKey, deploymentLink } from './deploymentViewUtils';
import { useThemedTableOptions } from './useThemedTableOptions';
import {
  DeploymentExplorerVersionFilter,
  matchesVersionFilter,
  type VersionFilterValue,
} from './deploymentExplorerVersionFilter';
import {
  groupModuleStackUses,
  type ModuleStackRelationship,
} from './moduleStackUsageRelationships';
import { MODULE_USAGE_MODE_LABEL, matchesFilters } from './usageContext';
import type { ModuleUsageMode, UsageContext } from './usageContext';
import { PAGE_SIZES, useExplorerUrlState } from './deploymentExplorerUrlState';
import { SegmentedToggle } from '../../../shared/components/SegmentedToggle';

const SOURCE_OPTIONS: readonly { value: ModuleUsageMode; label: string }[] = [
  { value: 'both', label: MODULE_USAGE_MODE_LABEL.both },
  { value: 'standalone', label: MODULE_USAGE_MODE_LABEL.standalone },
  { value: 'in-stacks', label: MODULE_USAGE_MODE_LABEL['in-stacks'] },
];

const STACK_COLUMNS = ['stackName', 'stackVersion'];
const NO_COLUMNS: string[] = [];

// A long deployment ID wraps inside its column instead of running under the next one.
const DEPLOYMENT_ID_BUTTON_SX = {
  justifyContent: 'flex-start',
  textAlign: 'left',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
} as const;

/** Shown in the stack columns of a deployment that is not part of a stack. */
const NO_STACK = '—';

type DeploymentExplorerTableRow = {
  id: string;
  /** Set for a module used inside a stack. Standalone deployments have none. */
  relationship?: ModuleStackRelationship;
  deployment: Deployment;
  moduleName: string;
  moduleVersion: string;
  stackName: string;
  stackVersion: string;
  account: string;
  region: string;
  environment: string;
  deploymentId: string;
  status: string;
};

type DeploymentExplorerTableProps = {
  /** Which module deployments the table lists. */
  source: ModuleUsageMode;
  onSourceChange: (source: ModuleUsageMode) => void;
  /** Module uses expanded from deployed stacks. */
  stackUses: StackModuleUsage[];
  /** Module deployments that are not part of a stack. */
  standaloneDeployments: Deployment[];
  filters: Pick<UsageContext, 'account' | 'region'>;
  projectNames: Record<string, string>;
  loading: boolean;
  incomplete: boolean;
};

/** Shows each module deployment, standalone or inside a stack, in its deployment context. */
export const DeploymentExplorerTable = ({
  source,
  onSourceChange,
  stackUses,
  standaloneDeployments,
  filters,
  projectNames,
  loading,
  incomplete,
}: DeploymentExplorerTableProps) => {
  const [selectedRelationship, setSelectedRelationship] = useState<ModuleStackRelationship | null>(
    null,
  );

  const data = useMemo(() => {
    const rows: DeploymentExplorerTableRow[] = [];
    const accountLabel = (deployment: Deployment) => {
      const projectName = projectNames[deployment.project_id];
      return projectName && projectName !== deployment.project_id
        ? `${projectName} (${deployment.project_id})`
        : deployment.project_id;
    };
    const addRow = (
      deployment: Deployment,
      stack: { name: string; version: string },
      relationship?: ModuleStackRelationship,
    ) => {
      rows.push({
        id: JSON.stringify([
          deployment.module,
          deployment.module_version,
          stack.name,
          stack.version,
          deploymentKey(deployment),
        ]),
        relationship,
        deployment,
        moduleName: deployment.module,
        moduleVersion: deployment.module_version,
        stackName: stack.name,
        stackVersion: stack.version,
        account: accountLabel(deployment),
        region: deployment.region,
        environment: deployment.environment,
        deploymentId: deployment.deployment_id,
        status: deployment.status,
      });
    };
    for (const relationship of groupModuleStackUses(stackUses)) {
      for (const deployment of relationship.deployments) {
        if (!matchesFilters(deployment, filters)) continue;
        addRow(
          deployment,
          { name: relationship.stackName, version: relationship.stackVersion },
          relationship,
        );
      }
    }
    for (const deployment of standaloneDeployments) {
      if (matchesFilters(deployment, filters)) {
        addRow(deployment, { name: NO_STACK, version: NO_STACK });
      }
    }
    return rows;
  }, [stackUses, standaloneDeployments, filters, projectNames]);

  const columns = useMemo<MRT_ColumnDef<DeploymentExplorerTableRow>[]>(
    () => [
      { accessorKey: 'moduleName', header: 'Module', size: 150 },
      {
        accessorKey: 'moduleVersion',
        header: 'Module version',
        size: 200,
        filterFn: (row, columnId, filterValue) =>
          matchesVersionFilter(
            String(row.getValue(columnId) ?? ''),
            filterValue as VersionFilterValue | undefined,
          ),
        Filter: ({ column }) => (
          <DeploymentExplorerVersionFilter
            value={column.getFilterValue() as VersionFilterValue | undefined}
            onChange={(value) => column.setFilterValue(value)}
          />
        ),
      },
      { accessorKey: 'stackName', header: 'Stack', size: 190 },
      {
        accessorKey: 'stackVersion',
        header: 'Stack version',
        size: 200,
        filterFn: (row, columnId, filterValue) =>
          matchesVersionFilter(
            String(row.getValue(columnId) ?? ''),
            filterValue as VersionFilterValue | undefined,
          ),
        Filter: ({ column }) => (
          <DeploymentExplorerVersionFilter
            value={column.getFilterValue() as VersionFilterValue | undefined}
            onChange={(value) => column.setFilterValue(value)}
          />
        ),
      },
      { accessorKey: 'account', header: 'Account name / project ID', size: 280 },
      { accessorKey: 'region', header: 'Region', size: 170, minSize: 150 },
      { accessorKey: 'environment', header: 'Environment', size: 190, minSize: 170 },
      {
        accessorKey: 'deploymentId',
        header: 'Deployment ID',
        size: 300,
        Cell: ({ row }) => {
          const { relationship, deployment, deploymentId } = row.original;
          if (!relationship) {
            return (
              <Button
                size="small"
                component={RouterLink}
                to={deploymentLink(deployment)}
                aria-label={`View deployment ${deploymentId}`}
                sx={DEPLOYMENT_ID_BUTTON_SX}
              >
                {deploymentId}
              </Button>
            );
          }
          return (
            <Button
              size="small"
              onClick={() =>
                setSelectedRelationship({
                  ...relationship,
                  deployments: [deployment as StackModuleUsage],
                })
              }
              aria-label={`View deployment ${deploymentId}`}
              sx={DEPLOYMENT_ID_BUTTON_SX}
            >
              {deploymentId}
            </Button>
          );
        },
      },
      { accessorKey: 'status', header: 'Status', size: 150, minSize: 130 },
    ],
    [],
  );

  const { state: gridState, handlers: gridHandlers } = useExplorerUrlState(
    source === 'standalone' ? STACK_COLUMNS : NO_COLUMNS,
  );

  const themedTableOptions = useThemedTableOptions<DeploymentExplorerTableRow>();
  const table = useMaterialReactTable({
    ...themedTableOptions,
    columns,
    data,
    getRowId: (row) => row.id,
    enableColumnActions: true,
    enableGrouping: true,
    enableColumnDragging: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    enableColumnFilters: true,
    enableGlobalFilter: true,
    enableSorting: true,
    enablePagination: true,
    enableFullScreenToggle: false,
    groupedColumnMode: 'reorder',
    initialState: {
      expanded: {},
      showColumnFilters: true,
      showGlobalFilter: true,
    },
    // The URL owns the page. The table's own reset would fire on every URL change, because each
    // one parses into new arrays; the handlers reset the page where a change calls for it.
    autoResetPageIndex: false,
    muiPaginationProps: { rowsPerPageOptions: PAGE_SIZES },
    // Without this the table clamps a bookmarked page against the still-empty data.
    state: { ...gridState, isLoading: loading },
    ...gridHandlers,
  });

  // Standalone deployments are not in a stack, so those columns stay hidden. Their grouping and
  // filters are dropped too, because they would otherwise stay in effect unseen.
  const { setGrouping, setColumnFilters } = table;
  useEffect(() => {
    if (source !== 'standalone') return;
    setGrouping((grouping) => grouping.filter((id) => !STACK_COLUMNS.includes(id)));
    setColumnFilters((filters) => filters.filter(({ id }) => !STACK_COLUMNS.includes(id)));
  }, [source, setGrouping, setColumnFilters]);

  return (
    <Card variant="outlined" sx={{ width: '100%' }}>
      <CardHeader
        title="Deployment Explorer"
        titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Show modules deployed
            </Typography>
            <SegmentedToggle
              value={source}
              options={SOURCE_OPTIONS}
              onChange={onSourceChange}
              ariaLabel="Deployment source"
            />
          </Box>
        }
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      />
      <CardContent>
        {incomplete && (
          <Alert severity="warning" role="status" sx={{ mb: 2 }}>
            Some relationship data could not be fully loaded, so this table may be incomplete.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Explore deployed module versions, standalone or inside stacks, by account, region,
          environment, and deployment.
        </Typography>
        {loading && <LinearProgress aria-label="Loading deployments" />}
        {!loading && data.length === 0 && (
          <Typography color="text.secondary">No deployments match the current filters.</Typography>
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
