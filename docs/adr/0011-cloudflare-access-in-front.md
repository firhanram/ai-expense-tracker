# Cloudflare Access in front, the Worker verifies its token

Supersedes the bearer token of story 43.

The deployed app sits behind one Cloudflare Access application covering its whole hostname: the SPA and `/api/*`, which are one Worker on one origin (ADR-0010). Access signs the owner in (its login policy allows only the owner's identity) and stops every other request at Cloudflare's edge.

The Worker does not trust that alone. Every `/api/*` request except `/api/health` must carry a valid Access token in the `Cf-Access-Jwt-Assertion` header: signed by one of the team's keys (`https://<team domain>/cdn-cgi/access/certs`), with `aud` equal to the application's AUD tag, `iss` equal to the team domain, and not expired. Anything else is `401 UNAUTHORIZED`. The team domain and AUD tag are Worker configuration (`ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`); if either is unset, every protected route is refused rather than opened.

## Why not the bearer token

A bearer token the browser sends has to reach the browser. Baked into the SPA bundle it is public, because the bundle is served to anyone who loads the page; typed in by the owner it is a password the design deliberately does not have ("no sign-in screen"). Access gives a real sign-in with no code of ours, and its cookie travels with every same-origin `fetch`, the streamed chat reply and receipt `<img>` tags.

## Why verify in the Worker too

Access protects a hostname, not a Worker. The Worker is also reachable on its `*.workers.dev` address and preview URLs unless they are turned off, and a future custom domain added without an Access application would be open. Verifying the token makes "not public" a property of the Worker rather than of the account's settings.

## Consequences

- `API_TOKEN` and `VITE_API_TOKEN` are removed. No credential ships in the bundle.
- The `*.workers.dev` address and preview URLs are disabled (or placed behind Access) when deploying.
- Local development has no Access. A request whose URL host is `localhost` or `127.0.0.1` is exempt, which is only reachable under `alchemy dev`: on Cloudflare a request is routed by its hostname, so a deployed Worker never sees a loopback host.
- Access's `CF_Authorization` cookie is ambient: the browser sends it with any request to the app, a cross-site form POST included, and Access then adds a valid token. So the Worker also refuses a POST, PATCH, PUT or DELETE that did not come from the app's own origin (`Sec-Fetch-Site: same-origin`, or, when that header is absent, an `Origin` equal to the request's) with `403 CROSS_SITE_REQUEST`, on loopback too. The Access application's cookie is set to `SameSite=Strict` (or `Lax`) and `HttpOnly` as a second layer. A script that writes must send an `Origin` header naming the app.
- Scripts and other non-browser callers use an Access service token (`CF-Access-Client-Id` / `CF-Access-Client-Secret`); Access turns it into the same signed header, so the Worker has one check.
- When the owner's Access session expires, API calls are redirected to Access's login instead of returning JSON. The SPA treats a redirected API response as "signed out" and reloads the page, so the owner lands on the login screen rather than an error.
- Signing in, sessions, revocation and audit live in the Cloudflare account, not in the app. The trade: the app cannot run anywhere Access is unavailable without bringing this decision back.

## Considered options

- **Passkeys with a session cookie in the app** (an earlier draft of ADR-0010). Rejected for now: it needs tables, routes, a setup flow and two screens the design does not have, and WebAuthn challenges would need shared storage because Workers run many instances. Revisit if the app ever leaves Cloudflare.
- **Bearer token entered once and kept on the device.** Rejected: it is a password in all but name, and the app cannot use localStorage in some contexts it runs in (DESIGN.md).
- **Access only, no check in the Worker.** Rejected: safe only while every route to the Worker is behind Access, which is an account setting that can silently change.
