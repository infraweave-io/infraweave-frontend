/**
 * Auth token lifecycle for the standalone app.
 *
 * Stores tokens in localStorage keyed as `auth_token` (id_token), `access_token`,
 * `refresh_token`, and the user object (with `providerId`). Refreshes the
 * id_token using the OAuth refresh_token grant before it expires, and on 401
 * responses. Concurrent fetches share a single in-flight refresh promise.
 */

import { decodeJwtPayload, getProvider, refreshTokens } from './oauth';
import { clearResourceNameCache } from './resourceNameCache';
import { clearProjectCache } from './projectCache';
import { clearFleetCache } from './fleetCache';

const EXPIRY_SKEW_SECONDS = 60;

let refreshInFlight: Promise<string | null> | null = null;

const readUserProviderId = (): string | null => {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as { providerId?: string };
    return user.providerId ?? null;
  } catch {
    return null;
  }
};

const getTokenExpirySeconds = (jwt: string): number | null => {
  try {
    const payload = decodeJwtPayload(jwt);
    const exp = payload.exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
};

const isExpiringSoon = (jwt: string, skewSeconds = EXPIRY_SKEW_SECONDS): boolean => {
  const exp = getTokenExpirySeconds(jwt);
  if (exp === null) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp - nowSeconds <= skewSeconds;
};

/**
 * Stored for the signed-in user only: tokens and every persisted selection. The caches are
 * cleared by their own functions in `clearSession`. `theme_mode` and `__app_mode__` belong
 * to the device, so they stay.
 */
const SESSION_KEYS = [
  'auth_token',
  'access_token',
  'refresh_token',
  'user',
  'oauth_state',
  'selectedProviders',
  'selectedProjectNames',
  'selectedRegions',
  'selectedProjectName',
  'selectedRegion',
  'selectedRepositoryData',
];

/**
 * Called however a session ends (sign-out, a 401 a refresh could not fix, a failed refresh),
 * so the next user in this browser inherits nothing from the last one.
 */
export const clearSession = (): void => {
  for (const key of SESSION_KEYS) localStorage.removeItem(key);
  clearResourceNameCache();
  clearProjectCache();
  clearFleetCache();
};

const clearAuthAndRedirect = () => {
  clearSession();
  window.location.href = '/';
};

const performRefresh = async (): Promise<string | null> => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  const providerId = readUserProviderId();
  if (!providerId) return null;

  const provider = getProvider(providerId);
  if (!provider) return null;

  const tokens = await refreshTokens(provider, refreshToken);
  if (!tokens.id_token) {
    throw new Error('Refresh response did not include id_token');
  }

  localStorage.setItem('auth_token', tokens.id_token);
  if (tokens.access_token) localStorage.setItem('access_token', tokens.access_token);
  // Most providers (Cognito) do NOT rotate the refresh token; only overwrite if present.
  if (tokens.refresh_token) localStorage.setItem('refresh_token', tokens.refresh_token);

  return tokens.id_token;
};

const sharedRefresh = (): Promise<string | null> => {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = performRefresh()
    .catch((err) => {
      console.error('Token refresh failed:', err);
      clearAuthAndRedirect();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
};

/**
 * Refresh the id_token if it is missing, malformed, or within the expiry skew.
 * Safe to call before every authenticated fetch. Returns the (possibly fresh)
 * token, or null if no token / refresh failed.
 */
export const ensureFreshAuthToken = async (): Promise<string | null> => {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;
  // Dummy token used when AUTH_DISABLED — never refresh.
  if (token === 'disabled_auth_dummy_token') return token;
  if (!isExpiringSoon(token)) return token;
  return sharedRefresh();
};

/**
 * Force a refresh regardless of expiry — used after a 401 response.
 */
export const forceRefreshAuthToken = (): Promise<string | null> => sharedRefresh();
