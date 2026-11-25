# Effect v4 on Railway, one SQLite file on a volume

The backend is an Effect v4 HTTP service deployed to Railway by Alchemy, with its data in a single SQLite file on a Railway volume. The frontend is a Vite SPA whose build output the same service serves as static files. There is no Docker Compose.

Cloudflare D1 was rejected: `@effect/sql-d1` dies on `withTransaction` (`transactions are not supported in D1`) and `@effect/sql/Migrator` dies with it, because the platform cannot hold a write transaction open across awaits. Draft-to-confirmed promotion is a multi-statement write, so this was disqualifying rather than inconvenient. Railway runs ordinary containers, so `@effect/sql-sqlite-node` gives real transactions and a working migrator.

Compose existed to give a local Node process a SQL surface outside a platform runtime. With the service already running on Node in production, `alchemy dev` provides the same process locally and Compose has no remaining job.

## Consequences

- **Exactly one API instance, permanently.** Railway volumes do not attach across services, so this rules out horizontal scaling and zero-downtime rolling deploys. Accepted: one user, a few thousand rows, no traffic.
- Backup is a file produced by `VACUUM INTO`, taken automatically before every migration. Never copy the live database file: in WAL mode a plain copy can be corrupt. There is no point-in-time recovery; Railway's volume PITR applies to volumes, not to application-level corruption by a bad migration.
- Postgres remains a viable migration — `@effect/sql-pg` implements the same `SqlClient`, so query code is portable. If this ever needs more than one instance, that is the change to make.
- The API service also serves the built SPA, so the app has one origin. ADR-0010's session cookie depends on this.
- Local and production run the same driver. This is deliberate: a dev environment that can do things production cannot is how migrations ship broken.
