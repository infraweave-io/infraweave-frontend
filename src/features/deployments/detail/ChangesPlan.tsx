import React, { useState, useEffect } from 'react';
import { useConfig } from '../../../hooks/useConfig';
import { Typography, Box, Chip, FormControlLabel, Checkbox, alpha } from '@mui/material';
import { MONO_FONT } from '../../../contexts/ThemeContext';
import {
  Progress,
  ResponseErrorPanel,
  LogViewer,
  Table,
  TableColumn,
} from '../../../standalone/components/ComponentAdapter';
import { ChangeRecord, ResourceChange } from '../../../types/Log';
import { Event } from '../../../types/Event';
import { Deployment } from '../../../types/Deployment';
import { useAsync } from '../../../hooks/useAsync';

export const ChangesPlan = (
  props: { event?: Event; deployment?: Deployment } = {
    event: undefined,
  },
) => {
  const { event, deployment } = props;

  const encodedEnvironment = encodeURIComponent(deployment?.environment ?? '');
  const encodedJobId = encodeURIComponent(event?.job_id ?? '');
  const encodedDeploymentId = encodeURIComponent(event?.deployment_id ?? '');
  const changeType = event?.event?.toUpperCase() ?? 'UNKNOWN';
  const project = deployment?.project_id;
  const region = deployment?.region;

  // State to hold the logs
  const [logs, setLogs] = useState<string | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [error, _setError] = useState<Error | null>(null);

  const config = useConfig();
  const fetchLogs = async (): Promise<ChangeRecord> => {
    console.log('Fetching change record');

    try {
      // Using config.getApiUrl() instead of backendBaseUrl
      const response = await config.fetch(
        config.getApiUrl(
          `api/proxy/api/infraweave/api/v1/change_record/${project}/${region}/${encodedEnvironment}/${encodedDeploymentId}/${encodedJobId}/${changeType}`,
        ),
      );

      if (response.status >= 300 && response.status < 400) {
        throw new Error('Redirected to login or guest page');
      }

      const json = await response.json();
      console.log('json', json);

      return json;
    } catch (err) {
      console.error('Error change record', err);
      throw err;
    }
  };

  const { value, loading, error: asyncError } = useAsync(fetchLogs, [event]);

  // Auto-refresh logic using useEffect
  useEffect(() => {
    // Only update the logs on the initial fetch
    if (value && !hasInitialLoad) {
      setLogs(value?.plan_std_output);
      setHasInitialLoad(true); // Mark initial load as completed
    }
  }, [event, value, hasInitialLoad]);

  // Error handling
  if (error) {
    return <ResponseErrorPanel error={error ?? asyncError} />;
  }

  // Only show loading spinner on initial load
  if (loading && !hasInitialLoad) {
    return <Progress />;
  }

  if (value?.resource_changes) {
    return <ResourceChangesTable changes={value.resource_changes} />;
  }

  console.log('change records', logs);

  return <LogViewer text={logs ?? 'failed to fetch change records'} />;
};

const ResourceChangesTable = ({ changes }: { changes: ResourceChange[] }) => {
  const [hideTagOnlyChanges, setHideTagOnlyChanges] = React.useState(false);

  const columns: TableColumn[] = [
    { title: 'Action', field: 'actionCell', width: '10%' },
    { title: 'Address', field: 'address', width: '40%' },
    { title: 'Type', field: 'resource_type', width: '25%' },
    { title: 'Name', field: 'name', width: '25%' },
  ];

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return 'success';
      case 'delete':
        return 'error';
      case 'update':
        return 'warning';
      case 'replace':
        return 'error'; // Often destructive
      default:
        return 'default';
    }
  };

  // Helper function to check if a resource has only tag changes
  const isTagOnlyChange = (change: ResourceChange): boolean => {
    if (!change.changes || Object.keys(change.changes).length === 0) {
      return false;
    }
    // Check if ALL changes are tag-related (keys starting with "tags." or "tags_all." or exactly "tags" or "tags_all")
    return Object.keys(change.changes).every(
      (key) =>
        key.startsWith('tags.') ||
        key.startsWith('tags_all.') ||
        key === 'tags' ||
        key === 'tags_all',
    );
  };

  // Filter changes based on hideTagOnlyChanges setting
  const filteredChanges = hideTagOnlyChanges ? changes.filter((c) => !isTagOnlyChange(c)) : changes;

  const data = filteredChanges.map((c) => ({
    actionCell: (
      <Chip
        label={c.action.toUpperCase()}
        size="small"
        color={getActionColor(c.action) as any}
        variant="outlined"
      />
    ),
    address: c.address,
    resource_type: c.resource_type,
    name: c.name,
    // Pass the full change object for details
    rawChange: c,
  }));

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <FormControlLabel
          control={
            <Checkbox
              checked={hideTagOnlyChanges}
              onChange={(e) => setHideTagOnlyChanges(e.target.checked)}
              size="small"
            />
          }
          label={<Typography variant="body2">Hide tag-only changes</Typography>}
        />
        {hideTagOnlyChanges && (
          <Typography variant="caption" color="text.secondary">
            (Filtered {changes.length - filteredChanges.length} resources)
          </Typography>
        )}
      </Box>
      <Table
        title="Resource Changes"
        options={{
          search: true,
          paging: false,
          padding: 'dense',
        }}
        columns={columns}
        data={data}
        detailPanel={(rowData: any) => {
          return <ResourceChangeDetails change={rowData.rawChange} />;
        }}
      />
    </Box>
  );
};

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const ResourceChangeDetails = ({ change }: { change: ResourceChange }) => {
  if (!change.changes)
    return <Typography variant="body2">No detailed changes available.</Typography>;

  const rows = Object.entries(change.changes).map(([key, diff]) => ({
    key,
    ...diff,
  }));

  if (rows.length === 0) return <Typography variant="body2">No attributes changed.</Typography>;

  return (
    <Box margin={1} sx={{ width: '100%', overflowX: 'auto' }}>
      <Typography variant="subtitle2" gutterBottom>
        Attribute Changes:
      </Typography>
      {/* Rendered as a plain table for fixed layout control, but styled through
          the theme so the diff reads correctly in dark mode too. */}
      <Box
        component="table"
        sx={{
          width: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          fontSize: '0.8125rem',
          '& th': {
            padding: '8px',
            textAlign: 'left',
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          },
          '& thead tr': { borderBottom: '1px solid', borderColor: 'divider' },
          '& tbody tr': { borderBottom: '1px solid', borderColor: 'divider' },
          '& td': {
            padding: '8px',
            fontFamily: MONO_FONT,
            overflowWrap: 'break-word',
            wordBreak: 'break-all',
            verticalAlign: 'top',
          },
        }}
      >
        <thead>
          <tr>
            <th style={{ width: '30%' }}>Attribute</th>
            <th style={{ width: '35%' }}>Before</th>
            <th style={{ width: '35%' }}>After</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isUnknown = row.after_unknown;
            const changed = JSON.stringify(row.before) !== JSON.stringify(row.after) && !isUnknown;

            const beforeStr = row.before !== undefined ? formatValue(row.before) : '-';
            const afterStr = row.after !== undefined ? formatValue(row.after) : '-';
            const canDiff =
              changed &&
              typeof row.before === 'string' &&
              typeof row.after === 'string' &&
              !isUnknown;

            // Only use inline diff for strings that are not JSON objects
            // Simple check: formatValue returns JSON.stringify for objects.
            // If original values are strings, formatValue returns them as is.
            const isJson = (str: string) =>
              str.trim().startsWith('{') || str.trim().startsWith('[');
            const shouldUseInlineDiff = canDiff && !isJson(beforeStr) && !isJson(afterStr);

            return (
              <tr key={row.key}>
                <Box component="td" sx={{ color: 'text.secondary' }}>
                  {row.key}
                </Box>
                <Box
                  component="td"
                  sx={{
                    bgcolor: changed
                      ? (theme) => alpha(theme.palette.error.main, 0.09)
                      : 'transparent',
                    color: changed ? 'error.main' : 'inherit',
                  }}
                >
                  {shouldUseInlineDiff ? (
                    <InlineDiff oldValue={beforeStr} newValue={afterStr} mode="before" />
                  ) : (
                    beforeStr
                  )}
                </Box>
                <Box
                  component="td"
                  sx={{
                    bgcolor: changed
                      ? (theme) => alpha(theme.palette.success.main, 0.09)
                      : 'transparent',
                    color: changed ? 'success.main' : 'inherit',
                  }}
                >
                  {isUnknown ? (
                    '(known after apply)'
                  ) : shouldUseInlineDiff ? (
                    <InlineDiff oldValue={beforeStr} newValue={afterStr} mode="after" />
                  ) : (
                    afterStr
                  )}
                </Box>
              </tr>
            );
          })}
        </tbody>
      </Box>
    </Box>
  );
};

const diffStrings = (oldS: string, newS: string) => {
  const N = oldS.length;
  const M = newS.length;
  // Use a flat array for DP to save memory if strings are large,
  // but for attribute values standard 2D array is fine given they are usually short.
  // Limiting diff computation to reasonable length to avoid performance issues
  if (N > 1000 || M > 1000) {
    return [
      { type: 'removed', value: oldS },
      { type: 'added', value: newS },
    ];
  }

  const dp: number[][] = Array(N + 1)
    .fill(0)
    .map(() => Array(M + 1).fill(0));

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      if (oldS[i - 1] === newS[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: { type: 'same' | 'added' | 'removed'; value: string }[] = [];
  let i = N;
  let j = M;

  // Reconstruct path
  // Note: There are multiple valid LCS paths. This approach favors matching later characters.
  const path = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldS[i - 1] === newS[j - 1]) {
      path.unshift({ type: 'same', value: oldS[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      path.unshift({ type: 'added', value: newS[j - 1] });
      j--;
    } else {
      path.unshift({ type: 'removed', value: oldS[i - 1] });
      i--;
    }
  }

  // Group consecutive changes
  if (path.length > 0) {
    let current = path[0];
    let buffer = current.value;

    for (let k = 1; k < path.length; k++) {
      if (path[k].type === current.type) {
        buffer += path[k].value;
      } else {
        result.push({ type: current.type as any, value: buffer });
        current = path[k];
        buffer = current.value;
      }
    }
    result.push({ type: current.type as any, value: buffer });
  }

  return result;
};

const InlineDiff = ({
  oldValue,
  newValue,
  mode,
}: {
  oldValue: string;
  newValue: string;
  mode: 'before' | 'after';
}) => {
  if (oldValue === newValue) return <span>{oldValue}</span>;

  const diffs = diffStrings(oldValue, newValue);

  return (
    <span>
      {diffs.map((part, i) => {
        if (part.type === 'same') {
          return <span key={i}>{part.value}</span>;
        }
        if (mode === 'before' && part.type === 'removed') {
          return (
            <Box
              key={i}
              component="span"
              sx={{
                bgcolor: (theme) => alpha(theme.palette.error.main, 0.22),
                textDecoration: 'line-through',
                borderRadius: '2px',
              }}
            >
              {part.value}
            </Box>
          );
        }
        if (mode === 'after' && part.type === 'added') {
          return (
            <Box
              key={i}
              component="span"
              sx={{
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.22),
                borderRadius: '2px',
              }}
            >
              {part.value}
            </Box>
          );
        }
        return null;
      })}
    </span>
  );
};
