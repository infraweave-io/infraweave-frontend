# Authentication Setup

The standalone app speaks OAuth 2.0 Authorization Code with PKCE (RFC 7636) against any OIDC-compliant IdP. Providers are declared via a single env var — `REACT_APP_OAUTH_PROVIDERS` — as a JSON array. Each entry describes one IdP; the login screen renders one button per entry.

PKCE is always used — there is no opt-out. If your IdP does not support PKCE it is not suitable for browser-based public clients; register the app as a Single-Page / public client type, which enables PKCE on every modern IdP (Cognito, Okta, Auth0, Azure AD, Keycloak, Google, ...).

## How the flow works

1. User clicks a provider button on `/`.
2. App generates a CSRF `state` + PKCE `code_verifier`, stashes them in `sessionStorage`, and redirects to the provider's `authorization_endpoint` with the SHA-256 `code_challenge`.
3. Provider authenticates the user and redirects to `<origin>/callback?code=...&state=...`.
4. `/callback` validates `state`, POSTs to `token_endpoint` with `code` + `code_verifier` (the IdP re-hashes it and rejects the exchange if it doesn't match the original challenge), receives `id_token` + `access_token`.
5. User info is decoded from the `id_token` and stashed in `localStorage` alongside the tokens. The app considers the user authenticated when `auth_token` exists.

Because step 4 runs in the browser, the OAuth client **must be public** (no client secret). PKCE is used by default and is required by most modern IdPs for public clients.

## Provider schema

```jsonc
{
  "id": "aws", // unique, used internally
  "displayName": "AWS", // button label: "Sign in with AWS"
  "type": "cognito", // "cognito" | "generic" (default: "generic")
  "domain": "my.auth.us-west-2.amazoncognito.com", // required when type=cognito
  "authorizationEndpoint": "https://.../authorize", // required when type=generic
  "tokenEndpoint": "https://.../token", // required when type=generic
  "clientId": "abc123", // required
  "scopes": "openid profile email", // string or array, default shown
  "icon": "cloud" // "cloud" | "lock" | (default login icon)
}
```

`type: "cognito"` is shorthand: given `domain`, the app derives `authorizationEndpoint = https://<domain>/oauth2/authorize` and `tokenEndpoint = https://<domain>/oauth2/token`. You can still override either explicitly.

Always configure **`<origin>/callback`** as the allowed redirect URI on the IdP side (e.g. `http://localhost:3000/callback`, `https://app.example.com/callback`). Scheme, host, port, and path must match character-for-character.

## Examples

### AWS Cognito (IAM Identity Center / user pool)

```bash
REACT_APP_OAUTH_PROVIDERS='[
  {
    "id": "aws",
    "type": "cognito",
    "displayName": "AWS",
    "domain": "my-app.auth.us-west-2.amazoncognito.com",
    "clientId": "7lus0pv1h7vtlglbijsaenldrr",
    "icon": "cloud"
  }
]'
```

App client must be a **public client** (no secret). Under **App integration → Hosted UI**, enable the Authorization code grant and `openid` / `profile` / `email` scopes. Cognito accepts PKCE on public clients.

### Okta

```bash
REACT_APP_OAUTH_PROVIDERS='[
  {
    "id": "okta",
    "displayName": "Okta",
    "authorizationEndpoint": "https://your-tenant.okta.com/oauth2/v1/authorize",
    "tokenEndpoint": "https://your-tenant.okta.com/oauth2/v1/token",
    "clientId": "0oa...",
    "icon": "lock"
  }
]'
```

Use an "OIDC - Single-Page Application" app with PKCE enabled.

### Auth0

```bash
REACT_APP_OAUTH_PROVIDERS='[
  {
    "id": "auth0",
    "displayName": "Auth0",
    "authorizationEndpoint": "https://your-tenant.auth0.com/authorize",
    "tokenEndpoint": "https://your-tenant.auth0.com/oauth/token",
    "clientId": "abc..."
  }
]'
```

Application type: **Single Page Application**. Token endpoint authentication method: **None**.

### Azure AD / Entra ID

```bash
REACT_APP_OAUTH_PROVIDERS='[
  {
    "id": "azure",
    "displayName": "Microsoft",
    "authorizationEndpoint": "https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/authorize",
    "tokenEndpoint": "https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token",
    "clientId": "...",
    "scopes": "openid profile email offline_access"
  }
]'
```

Register the app as **SPA** (not Web), which enables CORS on the token endpoint and requires PKCE.

### Keycloak

```bash
REACT_APP_OAUTH_PROVIDERS='[
  {
    "id": "keycloak",
    "displayName": "SSO",
    "authorizationEndpoint": "https://kc.example.com/realms/myrealm/protocol/openid-connect/auth",
    "tokenEndpoint": "https://kc.example.com/realms/myrealm/protocol/openid-connect/token",
    "clientId": "infraweave"
  }
]'
```

Client must be **public** with **Standard Flow** (authorization code) and **Web Origins** allowing your app origin.

### Multiple IdPs

Just add more entries — the login page renders one button per provider:

```bash
REACT_APP_OAUTH_PROVIDERS='[
  {"id":"aws","type":"cognito","displayName":"AWS","domain":"...","clientId":"...","icon":"cloud"},
  {"id":"okta","displayName":"Okta (corp)","authorizationEndpoint":"...","tokenEndpoint":"...","clientId":"...","icon":"lock"}
]'
```

## Troubleshooting

**"Authentication Failed: Failed to fetch"** on `/callback`
: The token endpoint is rejecting the browser request. Usually the client has a secret (must be public) or CORS is not enabled on the token endpoint.

**`invalid_client` from the token endpoint**
: Client requires a secret. Recreate as a public/SPA client.

**`invalid_grant`**
: `redirect_uri` mismatch (incl. trailing slash, scheme, port) or the `code` was reused / expired. Clear `sessionStorage` and retry.

**"No pending OAuth flow found"**
: `sessionStorage` was cleared between authorize and callback (third-party cookie blockers, incognito quirks, etc.). Retry from the login page.

**`400` with `code_verifier` error**
: Stale verifier was sent, or the IdP is misconfigured. Clear `sessionStorage` and retry. Make sure the OAuth client is registered as SPA / public — PKCE is mandatory in this app.

**CORS error on POST to token endpoint**
: Common on Azure AD when the app is registered as "Web" instead of "SPA", or on Okta when the app type is "Web". Recreate as SPA / public.

## Disabling auth (development only)

Set `REACT_APP_AUTH_DISABLED=true` to skip the login flow entirely. A dummy token is written to `localStorage` so code that reads `auth_token` doesn't crash. This is baked into `.env.mock`.
