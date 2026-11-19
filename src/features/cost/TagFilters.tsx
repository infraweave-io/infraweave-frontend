import React, { useEffect, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Popover,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

/** Tag key to the values to keep. */
export type TagFilterMap = Record<string, string[]>;

export const TagFilterChips = ({
  filters,
  onRemove,
}: {
  filters: TagFilterMap;
  onRemove: (key: string) => void;
}) => (
  <>
    {Object.entries(filters).map(([key, values]) => (
      <Chip
        key={key}
        size="small"
        label={`${key}: ${values.join(', ')}`}
        onDelete={() => onRemove(key)}
      />
    ))}
  </>
);

/**
 * A button that opens a tag filter picker. Both are chosen from lists rather than typed: the keys
 * are the tags Cost Explorer has cost for, and the values those found on deployment costs, since
 * which tags exist differs per account and changes over time.
 */
export const AddTagFilter = ({
  tagKeys,
  loadingKeys,
  loadValues,
  onAdd,
}: {
  tagKeys: string[];
  loadingKeys: boolean;
  loadValues: (key: string) => Promise<string[]>;
  onAdd: (key: string, values: string[]) => void;
}) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [values, setValues] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    setValues([]);
    setOptions([]);
    if (!key) return undefined;
    let cancelled = false;
    setLoadingOptions(true);
    loadValues(key)
      .then((found) => !cancelled && setOptions(found))
      .catch(() => !cancelled && setOptions([]))
      .finally(() => !cancelled && setLoadingOptions(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const close = () => {
    setAnchor(null);
    setKey(null);
  };

  return (
    <>
      <Button size="small" startIcon={<AddIcon />} onClick={(e) => setAnchor(e.currentTarget)}>
        Tag filter
      </Button>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 340, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Autocomplete
            size="small"
            options={tagKeys}
            value={key}
            onChange={(_, next) => setKey(next)}
            loading={loadingKeys}
            noOptionsText={loadingKeys ? 'Loading tags…' : 'No tags with cost in these accounts'}
            renderInput={(params) => <TextField {...params} label="Tag" autoFocus />}
          />
          <Autocomplete
            multiple
            disableCloseOnSelect
            size="small"
            disabled={!key}
            options={options}
            value={values}
            onChange={(_, next) => setValues(next)}
            loading={loadingOptions}
            noOptionsText={
              loadingOptions ? 'Loading values…' : 'No deployment costs carry this tag'
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Values"
                placeholder={key && values.length === 0 ? 'Pick values' : undefined}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingOptions && <CircularProgress size={14} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          {key && !loadingOptions && options.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              No deployment costs in the selected range carry this tag.
            </Typography>
          )}
          <Box display="flex" justifyContent="flex-end" gap={1}>
            <Button size="small" onClick={close}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={!key || values.length === 0}
              onClick={() => {
                if (key) onAdd(key, values);
                close();
              }}
            >
              Add
            </Button>
          </Box>
        </Box>
      </Popover>
    </>
  );
};
