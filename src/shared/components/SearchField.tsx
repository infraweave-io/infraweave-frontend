import React from 'react';
import { IconButton, InputAdornment, SxProps, TextField, Theme } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Close';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /**
   * Accessible name. Defaults to the placeholder, which is usually the same
   * sentence — pass it separately only when they should differ.
   */
  ariaLabel?: string;
  /**
   * Focus on mount. For a page whose primary action is finding one row in a long
   * list, typing should just work.
   */
  autoFocus?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * The filter box used by every fuzzy-searched list, so they share one set of
 * affordances: a leading icon, a clear button that appears once something is
 * typed, and Escape to clear.
 */
export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoFocus = false,
  sx,
}) => (
  <TextField
    size="small"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    autoFocus={autoFocus}
    // Escape is the way out of a filter that hid what the user was looking at,
    // without having to reach for the clear button.
    onKeyDown={(event) => {
      if (event.key === 'Escape' && value !== '') {
        event.stopPropagation();
        onChange('');
      }
    }}
    // Deliberately not `type="search"`: Chrome and Safari draw their own
    // clear button for that, which next to the one below made two.
    inputProps={{ 'aria-label': ariaLabel ?? placeholder }}
    sx={sx}
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          <SearchIcon fontSize="small" color="disabled" />
        </InputAdornment>
      ),
      endAdornment: value ? (
        <InputAdornment position="end">
          <IconButton size="small" aria-label="Clear search" onClick={() => onChange('')}>
            <ClearIcon fontSize="small" />
          </IconButton>
        </InputAdornment>
      ) : undefined,
    }}
  />
);
