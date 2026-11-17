import React from 'react';
import { WidgetIdContext } from './widgetSettings';

export type WidgetReload = () => void | Promise<unknown>;

type RegisterReload = (widgetId: string, reload: WidgetReload) => () => void;

/** Provided by `WidgetContainer`, which shows a reload button for each widget that registers. */
export const WidgetReloadContext = React.createContext<RegisterReload | null>(null);

/**
 * Gives the widget a reload button that calls `reload`, for widgets with data that can go
 * stale. Return a promise to keep the button spinning until it settles. Does nothing outside a
 * `WidgetContainer`.
 */
export const useOnWidgetReload = (reload: WidgetReload): void => {
  const widgetId = React.useContext(WidgetIdContext);
  const register = React.useContext(WidgetReloadContext);
  const reloadRef = React.useRef(reload);
  reloadRef.current = reload;

  React.useEffect(
    () => (widgetId && register ? register(widgetId, () => reloadRef.current()) : undefined),
    [widgetId, register],
  );
};
