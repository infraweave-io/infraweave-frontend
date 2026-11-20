import React, { Fragment } from 'react';
import { Chip, Typography } from '@mui/material';
import type { MRT_RowData, MRT_TableInstance } from 'material-react-table';

type GroupingSummaryProps<TData extends MRT_RowData> = {
  table: MRT_TableInstance<TData>;
  /** Lets the user ungroup by clicking the chip's delete icon. */
  removable: boolean;
};

/**
 * "Grouped by [Column], then by [Column]" label for a table's top toolbar. Stands in for MRT's
 * alert banner, which is an info Alert overlaid on the toolbar row. Only render it while the
 * table is grouped: an empty element still takes a flex slot and pushes the search to the left.
 */
export const GroupingSummary = <TData extends MRT_RowData>({
  table,
  removable,
}: GroupingSummaryProps<TData>) => {
  const { grouping } = table.getState();
  const { groupedBy, thenBy } = table.options.localization;

  return (
    <Typography
      component="div"
      variant="body2"
      color="text.secondary"
      // The toolbar row is top-aligned; centre against the search field beside it.
      sx={{ alignSelf: 'center', px: 1 }}
    >
      {groupedBy}{' '}
      {grouping.map((columnId, index) => {
        const column = table.getColumn(columnId);
        return (
          <Fragment key={columnId}>
            {index > 0 && thenBy}
            <Chip
              size="small"
              variant="outlined"
              label={column.columnDef.header}
              onDelete={removable ? () => column.toggleGrouping() : undefined}
            />
          </Fragment>
        );
      })}
    </Typography>
  );
};

/** `renderTopToolbarCustomActions` that shows the summary only while the table is grouped. */
export const renderGroupingSummary = <TData extends MRT_RowData>(removable: boolean) =>
  function renderGroupingSummaryContent({ table }: { table: MRT_TableInstance<TData> }) {
    return table.getState().grouping.length > 0 ? (
      <GroupingSummary table={table} removable={removable} />
    ) : null;
  };
