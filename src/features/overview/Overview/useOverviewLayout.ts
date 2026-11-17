import React from 'react';
import { PlacedWidget, WIDGET_SIZES } from '../../widgets/WidgetContainer';
import { DEFAULT_OVERVIEW_LAYOUT, OVERVIEW_WIDGETS } from './overviewWidgets';

// A localStorage key name, not a credential; gitleaks' generic-api-key rule misreads it.
export const OVERVIEW_LAYOUT_KEY = 'infraweave.overviewLayout.v1'; // gitleaks:allow

const isPlacedWidget = (entry: unknown): entry is PlacedWidget => {
  const { id, size } = (entry ?? {}) as Partial<PlacedWidget>;
  return (
    OVERVIEW_WIDGETS.some((widget) => widget.id === id) &&
    WIDGET_SIZES.some((option) => option.value === size)
  );
};

/**
 * The saved layout, without widgets that no longer exist or appear twice, or null when there
 * is none.
 */
const readLayout = (): PlacedWidget[] | null => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(OVERVIEW_LAYOUT_KEY) ?? 'null');
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter(isPlacedWidget)
      .filter((entry, index, all) => all.findIndex((other) => other.id === entry.id) === index)
      .map(({ id, size }) => ({ id, size }));
  } catch {
    return null;
  }
};

/** The Overview's widgets, their order and sizes, kept in this browser. */
export const useOverviewLayout = () => {
  const [layout, setLayoutState] = React.useState<PlacedWidget[]>(
    () => readLayout() ?? DEFAULT_OVERVIEW_LAYOUT,
  );

  const setLayout = (next: PlacedWidget[]) => {
    setLayoutState(next);
    try {
      localStorage.setItem(OVERVIEW_LAYOUT_KEY, JSON.stringify(next));
    } catch {
      // Storage full or blocked: the layout still applies until the page is left.
    }
  };

  /** Forgets the saved layout, so later changes to the default reach this user too. */
  const resetLayout = () => {
    setLayoutState(DEFAULT_OVERVIEW_LAYOUT);
    try {
      localStorage.removeItem(OVERVIEW_LAYOUT_KEY);
    } catch {
      // Nothing to forget.
    }
  };

  return { layout, setLayout, resetLayout };
};
