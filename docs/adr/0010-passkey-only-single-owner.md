# Passkeys are the only way in, and there is one owner

The app has exactly one owner and no sign-up. The owner signs in with a passkey (WebAuthn, via `@simplewebauthn/server` and `@simplewebauthn/browser`) and gets a session cookie. There are no passwords, no email sign-in and no OAuth.

The app holds a year of someone's spending and is reachable on the public internet, so "not public" has to be enforced by the app itself rather than assumed. A passkey is the strongest credential that costs the owner nothing to use: one Face ID or fingerprint, no password to leak or reuse, and it cannot be phished, because the browser only offers it on the domain it was created for.

## The one rule that matters

**Registering a passkey requires either a valid session or the `SETUP_TOKEN` secret.** Nothing else opens registration.

- First run: the owner deploys with `SETUP_TOKEN` set, opens the app, enters the token and creates a passkey. Then they delete `SETUP_TOKEN` from the environment. With no token configured, registration is only reachable from a signed-in session.
- A second device is added from a signed-in session.
- Total loss of every device: set a new `SETUP_TOKEN`, register again, delete it again.

Whoever registers first owns the app, which is why there is no "open while empty" mode: a stranger who found the URL between deploy and setup would get there first.

## Consequences

- Two tables, `passkey` and `session`, under the same `Migrator` as everything else.
- Sessions are 32 random bytes in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. The database stores only a SHA-256 hash of the id, so a copied database file holds no usable session. Sessions last 30 days and renew when used.
- Every route except `/auth/*` and `/health` requires a session. Protection is the default and the open routes are an explicit list, so a new route is protected without anyone remembering to protect it.
- Every sign-in requires user verification (`userVerification: "required"`), so an unlocked laptop is not enough; the owner's face, fingerprint or device PIN is.
- WebAuthn challenges live in memory for five minutes and are single-use. That is only safe because ADR-0005 fixes the API at one instance.
- A passkey works only on the domain it was created on (the relying-party id). The production domain must be settled before the first registration; moving domains means registering again.
- The SPA and the API share one origin, so the cookie needs no cross-site settings and receipt `<img>` tags authenticate without extra work.
- The owner can see and remove passkeys. Removing the last one is refused, because it would lock the owner out until the setup token is restored.

## Considered Options

- **No authentication in the app; rely on the deployment** (for example an identity-aware proxy in front). Rejected: it works only while the origin is never reachable directly, which is a deployment property that silently breaks if a public domain is ever added.
- **Better Auth with its passkey plugin.** It supports passkey-first registration (`registration.requireSession: false` with `resolveUser`) and would handle sessions. Rejected for this app: it brings `user`, `session`, `account` and `verification` tables built for many users, its own Kysely and `better-sqlite3` stack beside `@effect/sql-sqlite-node`, and its own migration CLI beside the `Migrator`. The single-owner lock would still be custom code in `resolveUser`. Revisit if multiple users come into scope.
- **A password.** Rejected: weaker in every way that matters and no easier to use than a fingerprint.
