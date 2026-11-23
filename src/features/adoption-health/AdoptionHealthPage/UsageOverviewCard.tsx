import React from 'react';
import {
  Autocomplete,
  Box,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Typography,
} from '@mui/material';
import type { Deployment } from '../../../types/Deployment';
import { ModuleOverview } from './ModuleOverview';
import {
  COUNT_NOUN,
  filterSummary,
  MODULE_USAGE_MODE_LABEL,
  StackUsageIncompleteChip,
} from './usageContext';
import type { ModuleUsageMode, UsageKind, UsageContext } from './usageContext';

export type UsageOverviewCardProps = {
  kind: UsageKind;
  selectedName: string;
  options: string[];
  deployments: Deployment[];
  projectNames: Record<string, string>;
  filters: Pick<UsageContext, 'region' | 'account'>;
  moduleUsageMode?: ModuleUsageMode;
  stackDataIncomplete: boolean;
  overviewRef: React.Ref<HTMLDivElement>;
  onSelectName: (name: string) => void;
  onVersionClick: (version: string) => void;
  accountHref: (projectId: string) => string;
};

export const UsageOverviewCard = ({
  kind,
  selectedName,
  options,
  deployments,
  projectNames,
  filters,
  moduleUsageMode,
  stackDataIncomplete,
  overviewRef,
  onSelectName,
  onVersionClick,
  accountHref,
}: UsageOverviewCardProps) => {
  const label = kind === 'module' ? 'Module' : 'Stack';
  const activeFilters = filterSummary(filters, projectNames);
  const source = moduleUsageMode
    ? `Source: ${MODULE_USAGE_MODE_LABEL[moduleUsageMode]}`
    : undefined;
  const subheader =
    activeFilters && source ? `${activeFilters} · ${source}` : (activeFilters ?? source);
  const countNoun = COUNT_NOUN[moduleUsageMode ?? 'standalone'];

  return (
    <Card ref={overviewRef} variant="outlined" sx={{ width: '100%', mb: 3 }}>
      <CardHeader
        title={`${label} Fleet Overview`}
        subheader={subheader}
        action={stackDataIncomplete && selectedName ? <StackUsageIncompleteChip /> : undefined}
        titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      />
      <CardContent>
        <Typography variant="body1" paragraph>
          Pick a {kind} to see its {countNoun.plural} by account and region.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: selectedName ? 3 : 0 }}>
          <Autocomplete
            options={options}
            value={selectedName || null}
            onChange={(_, newValue) => onSelectName(newValue ?? '')}
            renderInput={(params) => (
              <TextField {...params} label={`Select ${label}`} variant="outlined" />
            )}
            sx={{ width: 300 }}
          />
        </Box>

        {selectedName && (
          <ModuleOverview
            kind={kind}
            deployments={deployments}
            projectNames={projectNames}
            onVersionClick={onVersionClick}
            accountHref={accountHref}
            countNoun={countNoun}
          />
        )}
      </CardContent>
    </Card>
  );
};
