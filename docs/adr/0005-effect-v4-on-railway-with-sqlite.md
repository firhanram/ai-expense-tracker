# Effect v4 on Railway, one SQLite file on a volume

**Superseded by ADR-0010.** Railway was replaced by Cloudflare with D1. The rejection of D1 below assumed confirmation was a multi-statement write. ADR-0002 makes it a single-row `UPDATE`, so that assumption was wrong.

The backend is an Effect v4 HTTP service deployed to Railway by Alchemy, with its data in a single SQLite file on a Railway volume. The frontend is a separate Vite SPA, also deployed by Alchemy. There is no Docker Compose.

Cloudflare D1 was rejected: `@effect/sql-d1` dies on `withTransaction` (`transactions are not supported in D1`) and `@effect/sql/Migrator` dies with it, because the platform cannot hold a write transaction open across awaits. Draft-to-confirmed promotion is a multi-statement write, so this was disqualifying rather than inconvenient. Railway runs ordinary containers, so `@effect/sql-sqlite-node` gives real transactions and a working migrator.

Compose existed to give a local Node process a SQL surface outside a platform runtime. With the service already running on Node in production, `alchemy dev` provides the same process locally and Compose has no remaining job.

## Consequences

- **Exactly one API instance, permanently.** Railway volumes do not attach across services, so this rules out horizontal scaling and zero-downtime rolling deploys. Accepted: one user, a few thousand rows, no traffic.
- Backup is copying a file. There is no point-in-time recovery; Railway's volume PITR applies to volumes, not to application-level corruption by a bad migration.
- Postgres remains a viable migration — `@effect/sql-pg` implements the same `SqlClient`, so query code is portable. If this ever needs more than one instance, that is the change to make.
- Local and production run the same driver. This is deliberate: a dev environment that can do things production cannot is how migrations ship broken.
