import type { MRT_DensityState, MRT_RowData, MRT_TableOptions } from 'material-react-table';
import { alpha, useTheme } from '@mui/material/styles';
import { surfaces } from '../../../contexts/ThemeContext';
import { renderGroupingSummary } from './GroupingSummary';

/**
 * Vertical cell padding per density. `compact` matches the theme's `sizeSmall` table cell, the
 * densest the shared `Table` uses.
 */
const CELL_PADDING_Y: Record<MRT_DensityState, string> = {
  compact: '6px',
  comfortable: '12px',
  spacious: '18px',
};

/** MRT's expand toggle is 28px tall, which alone would set the row height of a grouped row. */
const EXPAND_BUTTON_SIZE = 20;

/** Width of the bar marking the left edge of a grouped row. */
const GROUP_BAR_WIDTH = 3;

/**
 * Makes a Material React Table look like the shared `Table` used by the details views:
 * a rounded outlined paper on the paper surface, a tinted header row of small uppercase
 * labels, and 16px cell gutters. Spread it first so a table can still override a part.
 *
 * `groupingRemovable` controls whether the "Grouped by" chips in the toolbar can be deleted.
 */
export const useThemedTableOptions = <TData extends MRT_RowData>({
  groupingRemovable = true,
}: { groupingRemovable?: boolean } = {}): Partial<MRT_TableOptions<TData>> => {
  const { palette } = useTheme();
  const { subtle } = surfaces[palette.mode];
  const primary = palette.primary.main;
  // Group rows step from strongest (outermost) to lightest; a leaf row has no bar.
  const groupStyle = [
    { bar: primary, fontWeight: 600 },
    { bar: alpha(primary, 0.45), fontWeight: 500 },
  ];

  return {
    // MRT paints rows with the page canvas by default, which reads as grey inside a white card.
    mrtTheme: { baseBackgroundColor: palette.background.paper },
    paginationDisplayMode: 'default',
    // Columns fill the card's width and grow with it. The floor leaves room for a label beside
    // the sort, drag and menu icons, so a narrow card scrolls sideways instead.
    layoutMode: 'grid',
    defaultColumn: { minSize: 170, size: 170 },
    muiTablePaperProps: {
      elevation: 0,
      variant: 'outlined',
      sx: { borderRadius: 2, overflow: 'hidden' },
    },
    muiTopToolbarProps: {
      sx: {
        borderBottom: 1,
        borderColor: 'divider',
        // MRT's icons are 24px, the rest of the app uses 20px.
        '& .MuiSvgIcon-root': { fontSize: '1.25rem' },
      },
    },
    muiBottomToolbarProps: {
      sx: { borderTop: 1, borderColor: 'divider', boxShadow: 'none' },
    },
    // MRT would show "Grouped by" in an info Alert overlaid on the toolbar row; render it as a
    // plain label in the toolbar's own layout instead.
    positionToolbarAlertBanner: 'none',
    renderTopToolbarCustomActions: renderGroupingSummary<TData>(groupingRemovable),
    muiSearchTextFieldProps: {
      variant: 'outlined',
      size: 'small',
      placeholder: 'Search',
      sx: { width: 240 },
    },
    muiFilterTextFieldProps: { variant: 'outlined', size: 'small' },
    muiTableHeadCellProps: {
      sx: {
        fontWeight: 600,
        backgroundColor: subtle,
        borderBottom: 1,
        borderColor: 'divider',
        px: 2,
        py: 1,
        '& .Mui-TableHeadCell-Content-Wrapper': {
          // MRT keeps short labels on one line and clips them; wrap instead of truncating.
          whiteSpace: 'normal',
          overflow: 'visible',
        },
      },
    },
    muiExpandButtonProps: {
      sx: { height: EXPAND_BUTTON_SIZE, width: EXPAND_BUTTON_SIZE },
    },
    muiTableBodyRowProps: ({ row }) => {
      if (!row.getIsGrouped()) return {};
      const { bar, fontWeight } = groupStyle[Math.min(row.depth, groupStyle.length - 1)];
      return {
        sx: {
          '& td': { fontWeight },
          '& td:first-of-type': { boxShadow: `inset ${GROUP_BAR_WIDTH}px 0 0 ${bar}` },
        },
      };
    },
    muiTableBodyCellProps: ({ table }) => ({
      sx: {
        px: 2,
        py: CELL_PADDING_Y[table.getState().density],
        borderBottom: 1,
        borderColor: 'divider',
        // Long values wrap inside their column; MRT would clip them or let them run on.
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
      },
    }),
  };
};
