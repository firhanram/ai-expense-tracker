# Taste

## Tooling & Architecture

- Prefers a separated frontend/backend architecture organized as a pnpm workspace monorepo, with the backend written in Effect TS. Confidence: 0.85
- Linter and formatter of choice are oxlint and tsgo (TypeScript native preview), not ESLint/Prettier. Confidence: 0.85
- Wants the whole stack startable with `docker compose` (clone-and-run self-hosting), not a hosted-only setup requiring external services. Confidence: 0.7
