# Taste

## Tooling & Architecture

- Prefers a separated frontend/backend architecture organized as a pnpm workspace monorepo, with the backend written in Effect TS. Confidence: 0.85
- Linter and formatter of choice are oxlint and oxfmt, not ESLint/Prettier; prefers the plain toolchain (oxlint `--type-aware` + TS 7 `tsc`) over patching native binaries for framework-specific lint plugins. Confidence: 0.85
- Wants clone-and-run local dev in as few commands as possible; `docker compose` is instrumental to that goal rather than a hard requirement, and he will drop it when the stack runs natively (e.g. `alchemy dev`). Confidence: 0.6
- Optimizes hard for low running cost: picks the cheapest option that still meets requirements (e.g. explicitly "the model must be cheap" for LLM choice) and expects concrete price comparisons rather than capability-first recommendations. Confidence: 0.55
