/**
 * Generic OAuth 2.0 / OpenID Connect provider registry for the standalone app.
 *
 * Providers are declared via the REACT_APP_OAUTH_PROVIDERS env var as a JSON
 * array. Each entry describes how to reach one IdP. A `cognito` preset lets
 * users point at a Cognito user pool domain without spelling out the full
 * authorize/token URLs.
 *
 * Example:
 *   REACT_APP_OAUTH_PROVIDERS='[
 *     {"id":"aws","type":"cognito","displayName":"AWS",
 *      "domain":"my-app.auth.us-west-2.amazoncognito.com",
 *      "clientId":"abc123"},
 *     {"id":"okta","displayName":"Okta",
 *      "authorizationEndpoint":"https://example.okta.com/oauth2/v1/authorize",
 *      "tokenEndpoint":"https://example.okta.com/oauth2/v1/token",
 *      "clientId":"0oa..."}
 *   ]'
 *
 * If OAUTH_PROVIDERS is not set but the legacy REACT_APP_AWS_COGNITO_DOMAIN +
 * REACT_APP_AWS_CLIENT_ID are, a single Cognito provider is synthesised for
 * backward compatibility.
 */

import { getEnv } from './env';

export type OAuthProviderInput = {
  id: string;
  displayName?: string;
  type?: 'cognito' | 'generic';
  /** Cognito hosted UI domain, no scheme. Used when type === 'cognito'. */
  domain?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  clientId: string;
  scopes?: string | string[];
  /** Optional icon hint ('cloud', 'lock', ...) rendered by the login page. */
  icon?: string;
};

export type OAuthProvider = {
  id: string;
  displayName: string;
  type: 'cognito' | 'generic';
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  scopes: string;
  icon?: string;
};

const DEFAULT_SCOPES = 'openid profile email';

const normaliseProvider = (input: OAuthProviderInput): OAuthProvider => {
  const type = input.type ?? (input.domain ? 'cognito' : 'generic');

  let authorizationEndpoint = input.authorizationEndpoint;
  let tokenEndpoint = input.tokenEndpoint;

  if (type === 'cognito') {
    if (!input.domain) {
      throw new Error(`OAuth provider "${input.id}" is type=cognito but has no "domain"`);
    }
    const domain = input.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    authorizationEndpoint ??= `https://${domain}/oauth2/authorize`;
    tokenEndpoint ??= `https://${domain}/oauth2/token`;
  }

  if (!authorizationEndpoint || !tokenEndpoint) {
    throw new Error(
      `OAuth provider "${input.id}" is missing authorizationEndpoint or tokenEndpoint`,
    );
  }
  if (!input.clientId) {
    throw new Error(`OAuth provider "${input.id}" is missing clientId`);
  }

  const scopes = Array.isArray(input.scopes)
    ? input.scopes.join(' ')
    : input.scopes ?? DEFAULT_SCOPES;

  return {
    id: input.id,
    displayName: input.displayName ?? input.id,
    type,
    authorizationEndpoint,
    tokenEndpoint,
    clientId: input.clientId,
    scopes,
    icon: input.icon,
  };
};

const readProvidersJson = (): OAuthProviderInput[] | null => {
  const raw = getEnv('REACT_APP_OAUTH_PROVIDERS') || getEnv('OAUTH_PROVIDERS');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error('REACT_APP_OAUTH_PROVIDERS must be a JSON array');
      return null;
    }
    return parsed as OAuthProviderInput[];
  } catch (err) {
    console.error('Failed to parse REACT_APP_OAUTH_PROVIDERS JSON:', err);
    return null;
  }
};

const readLegacyCognito = (): OAuthProviderInput | null => {
  const domain = getEnv('REACT_APP_AWS_COGNITO_DOMAIN');
  const clientId = getEnv('REACT_APP_AWS_CLIENT_ID');
  if (!domain || !clientId) return null;
  return {
    id: 'aws',
    displayName: 'AWS',
    type: 'cognito',
    domain,
    clientId,
    icon: 'cloud',
  };
};

let cachedProviders: OAuthProvider[] | null = null;

export const getProviders = (): OAuthProvider[] => {
  if (cachedProviders) return cachedProviders;

  const inputs = readProvidersJson() ?? (readLegacyCognito() ? [readLegacyCognito()!] : []);
  cachedProviders = inputs.map(normaliseProvider);
  return cachedProviders;
};

export const getProvider = (id: string): OAuthProvider | undefined =>
  getProviders().find((p) => p.id === id);

/**
 * Reset cached providers. Only used by tests.
 */
export const _resetProviderCache = () => {
  cachedProviders = null;
};

// ---------------------------------------------------------------------------
// PKCE helpers (RFC 7636)
// ---------------------------------------------------------------------------

const base64UrlEncode = (bytes: Uint8Array): string => {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const generateCodeVerifier = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
};

export const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
};

export const generateState = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
};

// ---------------------------------------------------------------------------
// Flow state (persisted between authorize redirect and callback)
// ---------------------------------------------------------------------------

const FLOW_STORAGE_KEY = 'oauth_flow';

export type OAuthFlowState = {
  providerId: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
};

export const saveFlowState = (state: OAuthFlowState) => {
  sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(state));
};

export const loadFlowState = (): OAuthFlowState | null => {
  const raw = sessionStorage.getItem(FLOW_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OAuthFlowState;
  } catch {
    return null;
  }
};

export const clearFlowState = () => {
  sessionStorage.removeItem(FLOW_STORAGE_KEY);
};

// ---------------------------------------------------------------------------
// Authorize URL + token exchange
// ---------------------------------------------------------------------------

export const buildAuthorizeUrl = (
  provider: OAuthProvider,
  redirectUri: string,
  state: string,
  codeChallenge: string,
): string => {
  const params = new URLSearchParams({
    client_id: provider.clientId,
    response_type: 'code',
    scope: provider.scopes,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${provider.authorizationEndpoint}?${params.toString()}`;
};

export type TokenResponse = {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
};

export const exchangeCodeForTokens = async (
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<TokenResponse> => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: provider.clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await fetch(provider.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as TokenResponse;
};

// ---------------------------------------------------------------------------
// User info extraction from ID token
// ---------------------------------------------------------------------------

export type UserInfo = {
  email?: string;
  name?: string;
  username?: string;
  sub?: string;
  providerId: string;
};

const decodeJwtPayload = (jwt: string): Record<string, unknown> => {
  const [, payload] = jwt.split('.');
  if (!payload) throw new Error('Malformed JWT');
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
};

export const extractUserInfo = (idToken: string, provider: OAuthProvider): UserInfo => {
  const payload = decodeJwtPayload(idToken);

  let email = (payload.email as string | undefined) ?? undefined;
  let name =
    (payload.name as string | undefined) ??
    (payload.preferred_username as string | undefined) ??
    undefined;

  // Cognito + IAM Identity Center quirk: cognito:username often contains the
  // email, sometimes with an IdentityCenter_ prefix.
  const cognitoUsername = payload['cognito:username'] as string | undefined;
  if (!email && cognitoUsername) {
    email = cognitoUsername.replace(/^IdentityCenter_/, '');
  }

  if (!email && Array.isArray(payload.identities)) {
    const first = payload.identities[0] as { userId?: string } | undefined;
    if (first?.userId) email = first.userId;
  }

  if (!name && email) {
    name = email.split('@')[0];
  }

  return {
    email,
    name,
    username: cognitoUsername ?? (payload.preferred_username as string | undefined),
    sub: payload.sub as string | undefined,
    providerId: provider.id,
  };
};
