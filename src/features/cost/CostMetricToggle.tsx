import React from 'react';
import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';

/** Which cost Cost Explorer reports; the API's default is the first. */
export const COST_METRICS = [
  {
    value: 'AmortizedCost',
    label: 'Amortized',
    hint: 'Savings Plan and Reserved Instance commitments spread over the usage they cover: what a deployment really costs. The same as unblended when there are no commitments.',
  },
  {
    value: 'UnblendedCost',
    label: 'Unblended',
    hint: 'What is billed, when it is billed. Usage covered by a Savings Plan or Reserved Instance shows as nearly free, since the commitment is billed on its own.',
  },
] as const;

export type CostMetric = (typeof COST_METRICS)[number]['value'];

export const DEFAULT_COST_METRIC: CostMetric = COST_METRICS[0].value;

export const CostMetricToggle = ({
  value,
  onChange,
}: {
  value: CostMetric;
  onChange: (metric: CostMetric) => void;
}) => (
  <ToggleButtonGroup
    size="small"
    exclusive
    value={value}
    onChange={(_, next: CostMetric | null) => next && onChange(next)}
    aria-label="Cost type"
  >
    {COST_METRICS.map((m) => (
      <Tooltip key={m.value} title={m.hint} enterDelay={500} describeChild>
        <ToggleButton value={m.value}>{m.label}</ToggleButton>
      </Tooltip>
    ))}
  </ToggleButtonGroup>
);
