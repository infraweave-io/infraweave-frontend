import React from 'react';
import { FormHelperText, MenuItem, Stack, TextField } from '@mui/material';
import semver from 'semver';

export type VersionFilterOperator = '<' | '>' | '=' | 'between';

export type VersionFilterValue = {
  operator: VersionFilterOperator;
  value: string;
  upperValue?: string;
};

type DeploymentExplorerVersionFilterProps = {
  value: VersionFilterValue | undefined;
  onChange: (value: VersionFilterValue | undefined) => void;
};

const trimmed = (value: string | undefined) => value?.trim() ?? '';

const isSemver = (value: string) => semver.valid(value) !== null;

const getFilterError = (filter: VersionFilterValue): string | undefined => {
  const lower = trimmed(filter.value);

  if (filter.operator === '=') {
    return lower ? undefined : 'Enter a version label to apply an exact-match filter.';
  }

  if (!lower) return 'Enter a version in SemVer format (for example, 1.2.3).';
  if (!isSemver(lower)) return 'Enter a valid SemVer version (for example, 1.2.3).';

  if (filter.operator !== 'between') return undefined;

  const upper = trimmed(filter.upperValue);
  if (!upper) return 'Enter an upper version in SemVer format (for example, 2.0.0).';
  if (!isSemver(upper)) return 'Enter a valid upper SemVer version (for example, 2.0.0).';
  if (semver.compare(lower, upper) > 0) {
    return 'Upper version must be greater than or equal to lower version.';
  }

  return undefined;
};

/** Returns true when a deployment version passes the selected filter. */
export const matchesVersionFilter = (
  version: string,
  filter: VersionFilterValue | undefined,
): boolean => {
  if (!filter || getFilterError(filter)) return true;

  const value = trimmed(filter.value);
  const candidate = trimmed(version);

  if (filter.operator === '=') return candidate === value;
  if (!isSemver(candidate)) return false;

  if (filter.operator === '<') return semver.compare(candidate, value) < 0;
  if (filter.operator === '>') return semver.compare(candidate, value) > 0;

  const upper = trimmed(filter.upperValue);
  return semver.compare(candidate, value) >= 0 && semver.compare(candidate, upper) <= 0;
};

export const DeploymentExplorerVersionFilter = ({
  value,
  onChange,
}: DeploymentExplorerVersionFilterProps) => {
  const operator = value?.operator ?? '=';
  const filterValue = value?.value ?? '';
  const upperValue = value?.upperValue ?? '';
  const error = value ? getFilterError(value) : undefined;

  const update = (changes: Partial<VersionFilterValue>) => {
    onChange({ operator, value: filterValue, upperValue, ...changes });
  };

  return (
    <Stack
      spacing={1}
      // Sits in a table header, so it fills the column instead of forcing its own width, and
      // resets the header's small-caps styling for its labels.
      sx={{
        width: '100%',
        minWidth: 0,
        whiteSpace: 'normal',
        textTransform: 'none',
        letterSpacing: 0,
        fontWeight: 400,
      }}
    >
      <Stack spacing={1.5} sx={{ pt: 1 }}>
        <TextField
          select
          size="small"
          label="Operator"
          value={operator}
          onChange={(event) => update({ operator: event.target.value as VersionFilterOperator })}
          fullWidth
        >
          <MenuItem value="=">=</MenuItem>
          <MenuItem value="&lt;">&lt;</MenuItem>
          <MenuItem value="&gt;">&gt;</MenuItem>
          <MenuItem value="between">between</MenuItem>
        </TextField>
        <TextField
          size="small"
          label={operator === 'between' ? 'From version' : 'Version'}
          value={filterValue}
          onChange={(event) => update({ value: event.target.value })}
          fullWidth
          error={Boolean(error)}
          aria-label="Version filter value"
        />
        {operator === 'between' && (
          <TextField
            size="small"
            label="To version"
            value={upperValue}
            onChange={(event) => update({ upperValue: event.target.value })}
            fullWidth
            error={Boolean(error)}
            aria-label="Upper version filter value"
          />
        )}
      </Stack>
      {error && (
        <FormHelperText error role="alert" sx={{ m: 0 }}>
          {error}
        </FormHelperText>
      )}
    </Stack>
  );
};
