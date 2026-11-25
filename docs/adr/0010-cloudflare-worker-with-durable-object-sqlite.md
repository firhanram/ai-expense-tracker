# Cloudflare Worker, data in one Durable Object's SQLite

Supersedes ADR-0005.

The app is one Cloudflare Worker, deployed by Alchemy. It serves the Vite SPA as static assets and forwards `/api/*` to a single Durable Object (`idFromName("owner")`). The Effect v4 `HttpApp` runs inside that object, and its data lives in the object's SQLite storage through `@effect/sql-sqlite-do`. Receipts go to R2 through a native binding. Nothing runs on Railway.

Railway was dropped because it needs prepaid credit before anything deploys. Cloudflare's free plan covers Workers, SQLite-backed Durable Objects, static assets and R2 at this app's volume.

D1 is still rejected for the reason ADR-0005 gave: it cannot hold a transaction, so `withTransaction` and the migrator fail. Durable Object storage does not have that problem. `@effect/sql-sqlite-do` implements `withTransaction` on `ctx.storage.transaction()` when it is given `ctx.storage`, and ships an `SqliteMigrator`. Promoting a Draft to confirmed stays one real transaction. Always construct the client with `storage`. Built from `sql` alone, it fails every transaction.

The SPA and the API share one Worker, so they share an origin. That means no CORS and no second deployment.

## Consequences

- **Exactly one database, permanently.** All state lives in one object, and one object runs in one place. This is the same constraint ADR-0005 accepted, but here the platform enforces it instead of leaving it to discipline. Deploys do not cause downtime.
- **Backups improve.** Durable Object SQLite supports point-in-time recovery for 30 days, which covers a bad migration. There is no file to copy any more, so an export means a route that dumps the tables.
- **Free-plan CPU limit.** Free Workers get a small CPU budget per request. Time spent waiting on the model or R2 doesn't count, but parsing a streamed response does. Measure `POST /chat` early (slice 6). If it goes over, the fix is the $5/month Workers Paid plan, not a code change.
- **Tests run in workerd.** The S1 seam drives the `HttpApp` through `@cloudflare/vitest-pool-workers` against a real Durable Object, so tests and production use the same driver. Dropping in `sqlite-node` for tests would bring back the dev/prod gap that ADR-0005 avoided on purpose.
- `alchemy dev` runs everything locally in Miniflare. It needs no Docker and no Cloudflare account.
- Postgres is still the way out: query code depends only on `SqlClient`. If this ever needs a second writer, that is the change to make.
