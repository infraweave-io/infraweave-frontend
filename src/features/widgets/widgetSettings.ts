import React from 'react';

// A localStorage key name, not a credential; gitleaks' generic-api-key rule misreads it.
const STORAGE_KEY = 'infraweave.widgetSettings.v1'; // gitleaks:allow

/** Settings by widget id, then by setting name. */
type StoredSettings = Record<string, Record<string, unknown>>;

const readAll = (): StoredSettings => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as StoredSettings)
      : {};
  } catch {
    return {};
  }
};

/** The id of the widget being rendered. `WidgetContainer` provides it. */
export const WidgetIdContext = React.createContext<string | null>(null);

type SettingValue = string | number | boolean | string[];

const isSameType = (stored: unknown, defaultValue: SettingValue): boolean =>
  Array.isArray(defaultValue)
    ? Array.isArray(stored) && stored.every((item) => typeof item === 'string')
    : typeof stored === typeof defaultValue;

/**
 * Like `useState`, but kept in this browser per widget, so a widget's filters and the like
 * survive a reload. A stored value of a different type than `defaultValue` is ignored. Outside a
 * `WidgetContainer` nothing is stored.
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Storage full or blocked: the setting still applies until the page is left.
    }
  };

  return [value, update];
};
