import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { Env } from '../utils/env';
import { ensureFreshAuthToken, forceRefreshAuthToken } from '../utils/authToken';

export interface AppConfig {
  backendBaseUrl: string;
  getString: (key: string) => string;
  getApiUrl: (path: string) => string;
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export interface ConfigContextType {
  config: AppConfig;
  isStandalone: boolean;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export interface ConfigProviderProps {
  children: ReactNode;
  backendBaseUrl?: string;
  isStandalone?: boolean;
}

// Region-specific API endpoints - configure via environment variables
// Example: REACT_APP_REGION_ENDPOINT_us_west_2=https://your-api-id.execute-api.us-west-2.amazonaws.com
const REGION_ENDPOINTS: Record<string, string> = {};

/**
 * ConfigProvider that works in both standalone and Backstage modes
 * - In standalone mode: Uses provided backendBaseUrl or environment variable
 * - In Backstage mode: This is bypassed and Backstage's configApiRef is used directly
 */
export const ConfigProvider: React.FC<ConfigProviderProps> = ({
  children,
  backendBaseUrl,
  isStandalone = false,
}) => {
  const baseUrl = backendBaseUrl || 'http://localhost:7007';

  const config = useMemo<AppConfig>(
    () => ({
      backendBaseUrl: baseUrl,
      getString: (key: string) => {
        if (key === 'backend.baseUrl') {
          return baseUrl;
        }
        throw new Error(`Config key ${key} not found in standalone mode`);
      },
      getApiUrl: (path: string) => {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;

        if (isStandalone) {
          // In standalone mode, call backend directly
          // Remove the Backstage proxy prefix if present
          const apiPath = cleanPath.replace('api/proxy/api/infraweave/', '');

          // Check if running in development mode
          const isDev = process.env.NODE_ENV === 'development';

          if (isDev) {
            // In dev mode, use relative path to leverage Vite proxy
            return `/${apiPath}`;
          }

          // Check if path contains a region and map to specific endpoint
          for (const [region, endpoint] of Object.entries(REGION_ENDPOINTS)) {
            if (apiPath.includes(`/${region}/`) || apiPath.endsWith(`/${region}`)) {
              const safeEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
              return `${safeEndpoint}/${apiPath}`;
            }
          }

          // Use absolute URL for production builds
          const safeBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
          return `${safeBaseUrl}/${apiPath}`;
        }
        // In Backstage mode, use the proxy pattern
        return `${baseUrl}/${cleanPath}`;
      },
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        // Add auth token to requests in standalone mode
        if (isStandalone) {
          const authDisabled = Env.AUTH_DISABLED;

          const buildRequest = (token: string | null): RequestInit => {
            const headers = new Headers(init?.headers);
            if (token) headers.set('Authorization', `Bearer ${token}`);
            return { ...init, headers };
          };

          const token = authDisabled
            ? localStorage.getItem('auth_token')
            : await ensureFreshAuthToken();

          let response = await fetch(input, buildRequest(token));

          // On 401, try a forced refresh once before clearing the session.
          if (response.status === 401 && !authDisabled) {
            const refreshed = await forceRefreshAuthToken();
            if (refreshed) {
              response = await fetch(input, buildRequest(refreshed));
            }
            if (response.status === 401) {
              localStorage.removeItem('auth_token');
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              localStorage.removeItem('user');
              localStorage.removeItem('selectedRegions');
              window.location.href = '/';
            }
          }

          return response;
        }
        return fetch(input, init);
      },
    }),
    [baseUrl, isStandalone],
  );

  return (
    <ConfigContext.Provider value={{ config, isStandalone }}>{children}</ConfigContext.Provider>
  );
};

export const useAppConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useAppConfig must be used within a ConfigProvider');
  }
  return context;
};

export const useIsStandalone = (): boolean => {
  const context = useContext(ConfigContext);
  return context?.isStandalone ?? false;
};
