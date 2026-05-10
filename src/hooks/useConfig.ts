import { useContext } from 'react';
import { ConfigContext, AppConfig } from '../contexts/ConfigContext';

/**
 * Config hook for standalone mode.
 * ConfigProvider MUST wrap the app.
 */
export const useConfig = (): AppConfig => {
  const configContext = useContext(ConfigContext);

  if (configContext) {
    return configContext.config;
  }

  throw new Error(
    'ConfigProvider is required. Make sure StandaloneApp is wrapping your components.',
  );
};
