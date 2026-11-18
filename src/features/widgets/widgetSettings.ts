import React from 'react';
import { readOwned, writeOwned } from '../../utils/ownedStorage';

// A localStorage key name, not a credential; gitleaks' generic-api-key rule misreads it.
const STORAGE_KEY = 'infraweave.widgetSettings.v1'; // gitleaks:allow

/** Settings by widget id, then by setting name. */
type StoredSettings = Record<string, Record<string, unknown>>;

const readAll = (): StoredSettings => {
  const stored = readOwned(STORAGE_KEY);
  return stored && typeof stored === 'object' && !Array.isArray(stored)
    ? (stored as StoredSettings)
    : {};
};

/** Forgets a widget's settings, so one added again later starts from its defaults. */
export const clearWidgetSettings = (widgetId: string): void => {
  const all = readAll();
  if (!(widgetId in all)) return;
  delete all[widgetId];
  writeOwned(STORAGE_KEY, all);
};

/** The id of the widget being rendered. `WidgetContainer` provides it. */
export const WidgetIdContext = React.createContext<string | null>(null);

type SettingValue = string | number | boolean | string[];

const isSameType = (stored: unknown, defaultValue: SettingValue): boolean =>
  Array.isArray(defaultValue)
    ? Array.isArray(stored) && stored.every((item) => typeof item === 'string')
    : typeof stored === typeof defaultValue;

/**
 * Like `useState`, but kept in this browser per user and widget, so a widget's filters and the
 * like survive a reload. A stored value of a different type than `defaultValue` is ignored.
 * Outside a `WidgetContainer` nothing is stored.
 */
export const useWidgetSetting = <T extends SettingValue>(
  name: string,
  defaultValue: T,
): [T, (value: T) => void] => {
  const widgetId = React.useContext(WidgetIdContext);
  const [value, setValue] = React.useState<T>(() => {
    const stored = widgetId ? readAll()[widgetId]?.[name] : undefined;
    return isSameType(stored, defaultValue) ? (stored as T) : defaultValue;
  });

  const update = (next: T) => {
    setValue(next);
    if (!widgetId) return;
    const all = readAll();
    all[widgetId] = { ...all[widgetId], [name]: next };
    writeOwned(STORAGE_KEY, all);
  };

  return [value, update];
};
