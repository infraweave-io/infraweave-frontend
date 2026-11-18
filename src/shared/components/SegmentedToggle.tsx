import React from 'react';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';

export type SegmentedToggleOption<Value extends string> = {
  value: Value;
  label: string;
};

export type SegmentedToggleProps<Value extends string> = {
  value: Value;
  options: readonly SegmentedToggleOption<Value>[];
  onChange: (value: Value) => void;
  ariaLabel: string;
};

export function SegmentedToggle<Value extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentedToggleProps<Value>) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      aria-label={ariaLabel}
      onChange={(_, nextValue: Value | null) => {
        if (nextValue !== null) {
          onChange(nextValue);
        }
      }}
    >
      {options.map((option) => (
        <ToggleButton key={option.value} value={option.value}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
