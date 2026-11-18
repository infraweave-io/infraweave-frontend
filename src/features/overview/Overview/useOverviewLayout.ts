import React from 'react';
import { PlacedWidget, WIDGET_SIZES } from '../../widgets/WidgetContainer';
import { readOwned, removeOwned, writeOwned } from '../../../utils/ownedStorage';
import { DEFAULT_OVERVIEW_LAYOUT, OVERVIEW_WIDGETS } from './overviewWidgets';

// A localStorage key name, not a credential; gitleaks' generic-api-key rule misreads it.
const OVERVIEW_LAYOUT_KEY = 'infraweave.overviewLayout.v1'; // gitleaks:allow

const isPlacedWidget = (entry: unknown): entry is PlacedWidget => {
  const { id, size } = (entry ?? {}) as Partial<PlacedWidget>;
  return (
    OVERVIEW_WIDGETS.some((widget) => widget.id === id) &&
    WIDGET_SIZES.some((option) => option.value === size)
  );
};

/**
 * This user's saved layout, without widgets that no longer exist or appear twice, or null when
 * there is none.
 */
const readLayout = (): PlacedWidget[] | null => {
  const stored = readOwned(OVERVIEW_LAYOUT_KEY);
  if (!Array.isArray(stored)) return null;
  return stored
    .filter(isPlacedWidget)
    .filter((entry, index, all) => all.findIndex((other) => other.id === entry.id) === index)
    .map(({ id, size }) => ({ id, size }));
};

/** The Overview's widgets, their order and sizes, kept in this browser for this user. */
export const useOverviewLayout = () => {
  const [layout, setLayoutState] = React.useState<PlacedWidget[]>(
    () => readLayout() ?? DEFAULT_OVERVIEW_LAYOUT,
  );

  const setLayout = (next: PlacedWidget[]) => {
    setLayoutState(next);
    writeOwned(OVERVIEW_LAYOUT_KEY, next);
  };

  /** Forgets the saved layout, so later changes to the default reach this user too. */
  const resetLayout = () => {
    setLayoutState(DEFAULT_OVERVIEW_LAYOUT);
    removeOwned(OVERVIEW_LAYOUT_KEY);
  };

  return { layout, setLayout, resetLayout };
};
