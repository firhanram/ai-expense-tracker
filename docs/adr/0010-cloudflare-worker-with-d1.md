# Cloudflare Worker with D1

Supersedes ADR-0005.

The app is one Cloudflare Worker, deployed by Alchemy. It serves the Vite SPA as static assets and runs the Effect v4 `HttpApp` for `/api/*`. Data lives in D1 through `@effect/sql-d1`, and receipts go to R2. Both are Worker bindings. Nothing runs on Railway.

Railway was dropped because it needs prepaid credit before anything deploys. Cloudflare's free plan covers Workers, D1, static assets and R2 at this app's volume.

ADR-0005 rejected D1 because it assumed Draft-to-confirmed promotion was a multi-statement write. It isn't. ADR-0002 makes confirmation a status change on the same row, which is one conditional `UPDATE`, and SQLite applies a single statement atomically. Nothing in the write path needs a transaction held open across awaits. That was the one thing D1 cannot do.

The SPA and the API share one Worker, so they share an origin. That means no CORS and no second deployment.

## Rules this imposes on code

- **Never call `sql.withTransaction`.** On D1 it is a defect (`Effect.die`), not a typed error. It slips past type checking and fails at runtime.
- **Every atomic write is one statement or one `D1Client.batch`.** A batch runs all-or-nothing but cannot read its own results partway through. Anything that would need a read followed by a dependent write becomes a single statement (`UPDATE … WHERE status = 'draft'`, `INSERT … RETURNING`) or uses ids generated before the batch.
- **Migrations are D1 migrations, not Effect's `Migrator`.** Effect's migrator needs a transaction. Numbered SQL files in `apps/api/migrations/` are applied by Alchemy's `D1Database` (`migrationsDir`) on deploy and in `alchemy dev`, and by `applyD1Migrations` in tests.

## Consequences

- **More than one instance is fine.** D1 has one primary and serializes writes to it, so the Worker scales freely and deploys cause no downtime. The one-instance constraint from ADR-0005 is gone.
- **Backups are D1 Time Travel.** It gives point-in-time restore, 7 days on the free plan and 30 on paid. `wrangler d1 export` produces a SQL dump.
- **Free-plan CPU limit.** Free Workers get a small CPU budget per request. Time spent waiting on the model, D1 or R2 doesn't count, but parsing a streamed response does. Measure `POST /chat` early (slice 6). If it goes over, the fix is the $5/month Workers Paid plan, not a code change.
- **Tests run in workerd.** The S1 seam drives the `HttpApp` through `@cloudflare/vitest-pool-workers` against a local D1, so tests and production use the same driver.
- `alchemy dev` runs everything locally in Miniflare. It needs no Docker and no Cloudflare account.
- Postgres is still the way out: query code depends only on `SqlClient`. If a future feature truly needs an interactive transaction, that is the change to make. Moving to Durable Object SQLite (`@effect/sql-sqlite-do`, which has real transactions) is the cheaper stop on the way.
