/**
 * localStorage values kept with the user they belong to, so the next user in this browser
 * never reads them. Each key holds one user's value; another user's write replaces it.
 */

import { decodeJwtPayload } from './oauth';

/** Stands in for a real token when auth is disabled; see StandaloneApp. */
const AUTH_DISABLED_TOKEN = 'disabled_auth_dummy_token';

/**
 * `iss|sub`, since a subject is only unique within its issuer. Null (memory only) when either
 * is missing; a username or email is not unique across providers, so it is no fallback.
 */
export const currentOwner = (): string | null => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return null;
    if (token === AUTH_DISABLED_TOKEN) return 'auth-disabled';
    const { iss, sub } = decodeJwtPayload(token);
    if (typeof iss !== 'string' || !iss || typeof sub !== 'string' || !sub) return null;
    return `${iss}|${sub}`;
  } catch {
    return null;
  }
};

type Owned = { owner: string; value: unknown };

/** The value stored under `key` for the current user, or undefined when there is none. */
export const readOwned = (key: string): unknown => {
  const owner = currentOwner();
  if (!owner) return undefined;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<Owned> | null;
    return parsed && typeof parsed === 'object' && parsed.owner === owner
      ? parsed.value
      : undefined;
  } catch {
    return undefined;
  }
};

/** Without a known owner nothing is stored, so it can never be read back by someone else. */
export const writeOwned = (key: string, value: unknown): void => {
  const owner = currentOwner();
  if (!owner) return;
  try {
    localStorage.setItem(key, JSON.stringify({ owner, value } satisfies Owned));
  } catch {
    // Storage full or blocked: the caller's in-memory value still applies for this page.
  }
};

export const removeOwned = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to remove.
  }
};
