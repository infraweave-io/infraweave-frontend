# InfraWeave Frontend

Standalone frontend application for the InfraWeave platform. Runs as a single-page React app (Vite + MUI) and talks to the InfraWeave backend API.

## Table of Contents

- [Quick Start](#quick-start)
- [Run Modes](#run-modes)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Production Build](#production-build)
- [Docker](#docker)
- [Authentication](#authentication)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

**Prerequisites:** Node.js 18+ and npm.

```bash
npm install
npm run start:mock      # fastest way to explore the UI — no backend required
```

The app opens at http://localhost:3000 with MSW intercepting all API calls.

---

## Run Modes

Each script invokes vite with a mode that loads the matching env file. `.env` (committed defaults) and `.env.local` (personal git-ignored overrides) auto-load in every mode; mode-specific files (`.env.mock`, `.env.real`) are layered on top.

| Script               | Vite invocation                              | Use when                                                                |
| -------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| `npm start`          | `vite`                                       | Personal dev config (`.env.local`)                                      |
| `npm run start:mock` | `vite --mode mock`                           | Exploring the UI with MSW mock data (`.env.mock`)                       |
| `npm run start:real` | `vite build --mode real && vite preview ...` | Production-style build served via `vite preview` against a real backend |

The `start:real` script runs `vite build` then `vite preview` — no HMR, no React StrictMode double-invocation. Useful for reproducing prod-only issues.

### Switching backends

Edit the relevant `.env*` file, or copy the example:

```bash
cp .env.example .env.local
```

---

## Configuration

Environment variables (prefix `REACT_APP_` or `VITE_`):

| Variable                                 | Purpose                                        | Default                 |
| ---------------------------------------- | ---------------------------------------------- | ----------------------- |
| `REACT_APP_API_URL` / `VITE_API_URL`     | Backend API base URL                           | `http://localhost:8080` |
| `REACT_APP_USE_MOCKS` / `VITE_USE_MOCKS` | Enable MSW mocking                             | `false`                 |
| `REACT_APP_AUTH_DISABLED`                | Bypass login (dev only)                        | `false`                 |
| `REACT_APP_OAUTH_PROVIDERS`              | JSON array of OAuth/OIDC providers — see below | —                       |

When mocks are on, the dev server skips its `/api` proxy and MSW handles every request. When mocks are off, the dev server proxies `/api/*` to `REACT_APP_API_URL` and forwards the `X-Trace-Id` response header.

### Runtime overrides (Docker)

In the Docker image, [docker-entrypoint.sh](docker-entrypoint.sh) writes a `/config.js` at container start that populates `window._env_` from container env vars. See [Docker](#docker).

---

## Project Structure

```
src/
├── features/           # Feature-scoped pages and components
│   ├── auth/           # OAuth/OIDC login + callback
│   ├── deployments/
│   ├── graph/          # xyflow-based dependency graph
│   ├── modules/ stacks/ policies/ providers/
│   ├── observability/
│   ├── overview/
│   └── root/           # App shell, routes, layout
├── standalone/         # Standalone entry point (StandaloneApp + mount)
├── mocks/              # MSW handlers and fixture data
├── contexts/ hooks/    # ConfigContext, useConfig, etc.
├── shared/ utils/      # Cross-feature helpers
└── types/
```

Entry point: [src/standalone/index.tsx](src/standalone/index.tsx) — referenced directly from [index.html](index.html).

---

## Testing

```bash
npm test                 # unit tests (vitest, happy-dom)
npm run test:watch
npm run test:e2e         # Playwright
npm run test:e2e:ui
npm run test:e2e:report
npm run lint             # tsc --noEmit
```

---

## Production Build

```bash
npm run build
```

Output goes to `build/`. Serve it with any static file server, or use `npm run start:real` to run `vite preview` against the built output with the `/api` proxy still wired up.

---

## Docker

```bash
docker build -t infraweave-frontend .

docker run --rm -d -p 3000:80 \
  -e BACKEND_URL="https://your-api-id.execute-api.us-west-2.amazonaws.com" \
  -e OAUTH_PROVIDERS='[{"id":"aws","type":"cognito","displayName":"AWS","domain":"your-domain.auth.us-west-2.amazoncognito.com","clientId":"your-client-id","icon":"cloud"}]' \
  infraweave-frontend
```

The entrypoint generates `/config.js` on each container start, so the same image can be deployed against any backend/IdP without rebuilding. Supported container env vars: `BACKEND_URL`, `OAUTH_PROVIDERS`, `AUTH_DISABLED`.

---

## Authentication

The app uses the OAuth 2.0 Authorization Code flow with PKCE and works against any OIDC-compliant IdP — Cognito, Okta, Auth0, Azure AD, Google, Keycloak, etc. Providers are declared via `REACT_APP_OAUTH_PROVIDERS` (JSON array). Each entry takes either a Cognito preset (`type: "cognito"` + `domain`) or raw `authorizationEndpoint` + `tokenEndpoint` URLs. Full schema, per-IdP callback URL config, and troubleshooting are in [AUTH_SETUP.md](AUTH_SETUP.md).

Because the token exchange runs in the browser, the OAuth client **must be public** (no client secret), and PKCE (RFC 7636) is always used — there is no opt-out. Register the OAuth client as SPA / public-client type to enable PKCE on the IdP side.

To bypass auth locally, set `REACT_APP_AUTH_DISABLED=true` (already set in `.env.mock`).

---

## Troubleshooting

**Mocks not loading.** Check that `REACT_APP_USE_MOCKS=true` (or `VITE_USE_MOCKS=true`) is set, and the browser console logs `[MSW] Mocking enabled.`. The service worker is at `public/mockServiceWorker.js`. Switching between mock and real modes clears cached project/region localStorage to prevent mock IDs from leaking into real API calls.

**CORS errors against a real backend.** The dev server proxies `/api/*` to `REACT_APP_API_URL`, so requests should originate from `http://localhost:3000`. If you see CORS failures, verify the app is hitting `/api/...` (not the backend URL directly).

**`invalid_client` from the token endpoint.** Your OAuth client has a secret. Recreate as a public client — see [AUTH_SETUP.md](AUTH_SETUP.md).

**Stale tokens.** `localStorage.clear()` in devtools, then retry login.

---

## License

Apache-2.0
