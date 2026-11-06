import React from 'react';
import { Alert } from '@mui/material';

type ListIncompleteProps = {
  /** What was being listed, e.g. `modules`. */
  label: string;
};

/**
 * Shown when paging stopped with pages still outstanding. Without it a truncated
 * list looks exactly like a complete one, which is the silent truncation
 * `usePaginatedItems` exists to fix — so it has to reach the user, not just the
 * console.
 */
export const ListIncomplete = ({ label }: ListIncompleteProps) => (
  <Alert severity="warning" sx={{ mt: 2 }}>
    This list is incomplete: loading {label} stopped before the registry was exhausted. Reload to
    try again.
  </Alert>
);
