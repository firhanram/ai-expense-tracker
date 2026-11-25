# Implementation plan

A chat-first expense tracker. The agent proposes Draft Expenses and renders its answers as UI; the user confirms with a button. Deployed to Cloudflare by Alchemy.

Read alongside `GLOSSARY.md` and `docs/adr/`. Where this plan and an ADR disagree, the ADR wins.

## Runtime shape

One Cloudflare Worker, declared in `alchemy.run.ts` (ADR-0010):

- **`apps/api`** — the Worker entry. It runs the Effect v4 `HttpApp` for `/api/*` and talks to D1, R2 and the model.
- **`apps/web`** — Vite SPA, built and served as the same Worker's static assets. Same origin as the API, so no CORS.
- **D1** — the database, reached through a Worker binding.
- **R2** — bucket for receipt images, reached through a Worker binding.
- **Alchemy** — `alchemy deploy` for the Worker, the D1 database (with its migrations) and the bucket. `alchemy dev` runs it all locally in Miniflare, with no Docker and no Cloudflare account.

## Repository layout

```
apps/
  api/        Effect v4 service: HTTP, SQL, AI, storage
  web/        React SPA: chat, expense list, OpenUI renderer
packages/
  contract/   Effect Schema types + API route definitions, shared by both
  ui/         OpenUI component library (Zod 4 props) + React components
alchemy.run.ts
```

`packages/contract` is the only coupling between the apps: the API derives its route types from it, the web app consumes them. `packages/ui` is imported twice for different reasons — `apps/web` renders the components, `apps/api` calls `generateSystemPrompt` so the model is told what it can emit.

## Dependencies

| Concern | Choice |
|---|---|
| Runtime | Effect v4 (`effect@^4.1`) |
| HTTP | `effect/http` (`HttpServer`, `HttpRouter`) |
| Model | `effect/ai` (in core) + `@effect/ai-openai-compat@4.1.5` |
| SQL | `@effect/sql-d1`; D1 migrations applied by Alchemy |
| Storage | R2 binding, wrapped in an Effect service |
| UI generation | `@openuidev/react-lang`, `@openuidev/lang-core` |
| Frontend | React + Vite + TanStack Router + TanStack Query + `@ui-sdk/react` + Tailwind |
| Charts | Recharts, wrapped in our own component |
| Validation | Effect Schema (API/DB), Zod 4 (OpenUI props only) |
| Toolchain | `typescript@7`, `oxlint --type-aware`, `oxfmt` |

No `@openuidev/react-ui` (it brings Radix, which duplicates ui-sdk), no `@effect/tsgo` (needs a patched native binary and drops musl).

**Do not install `@effect/ai`.** In v4 the AI modules live in `effect` itself (`effect/ai` exports `LanguageModel`, `Toolkit`, `Tool`, `Prompt`, `Response`). The standalone `@effect/ai` package tops out at 0.37.0 and peers on `effect ^3.22`, so adding it pulls a second, incompatible Effect. The provider packages (`@effect/ai-*@4.1.5`) peer directly on `effect ^4.1.5` and do not depend on that package.

There is no `@effect/ai-deepseek` provider, and there does not need to be: DeepSeek's API is OpenAI-compatible, so `@effect/ai-openai-compat` with a base-URL override is the client.

## Data

One D1 database. Migrations are numbered SQL files in `apps/api/migrations/`, applied by Alchemy's `D1Database` on deploy and in `alchemy dev`. Never call `sql.withTransaction`, because on D1 it dies at runtime. An atomic write is one statement or one `D1Client.batch` (ADR-0010). Confirm is `UPDATE expense SET status = 'confirmed' WHERE id = ? AND status IN ('draft','confirmed')`, so it is idempotent and needs no transaction.

```sql
CREATE TABLE category (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL
);

CREATE TABLE expense (
  id           TEXT PRIMARY KEY,
  amount       INTEGER NOT NULL,            -- whole Rupiah, > 0 for outflow, < 0 for a refund
  category_id  INTEGER NOT NULL REFERENCES category(id),
  merchant     TEXT,
  note         TEXT,
  occurred_at  TEXT NOT NULL,               -- 'YYYY-MM-DD', no time
  created_at   TEXT NOT NULL,               -- ISO 8601 UTC
  status       TEXT NOT NULL                -- 'draft' | 'confirmed' | 'discarded'
                 CHECK (status IN ('draft','confirmed','discarded')),
  needs_review INTEGER NOT NULL DEFAULT 0,
  receipt_key  TEXT                          -- R2 object key, null if no receipt
);

CREATE INDEX expense_status_date ON expense(status, occurred_at);
CREATE INDEX expense_draft ON expense(status) WHERE status = 'draft';

CREATE TABLE chat_message (
  id          TEXT PRIMARY KEY,
  role        TEXT NOT NULL,                -- 'user' | 'assistant'
  content     TEXT NOT NULL,                -- prose shown in the bubble
  ui_text     TEXT,                         -- raw OpenUI Lang, null for user turns
  created_at  TEXT NOT NULL
);
```

The 11 seeded categories: Groceries, Dining, Transport, Housing, Utilities, Health, Entertainment, Shopping, Education, Gifts, Other.

`receipt_key` sits on `expense` rather than in its own table: a receipt belongs to one Draft Expense, and an upload that becomes nothing is deleted rather than kept (ADR-0002, and the round-5 decision).

## API

All routes require `Authorization: Bearer $API_TOKEN`, except under loopback in development.

| Route | Purpose |
|---|---|
| `POST /chat` | Streams a response. Body: `{ message, clientDate, receiptKey? }`. Returns a text stream: prose interleaved with OpenUI Lang. |
| `GET /chat` | The conversation, newest page first. |
| `GET /expenses` | `?status=&from=&to=&categoryId=`. Confirmed by default. |
| `POST /expenses` | Manual create, bypassing the agent. |
| `PATCH /expenses/:id` | Edit amount, category, merchant, note, date. Works on drafts and confirmed. |
| `POST /expenses/:id/confirm` | Draft → confirmed. Idempotent. |
| `POST /expenses/:id/discard` | Draft → discarded. Keeps the row. |
| `DELETE /expenses/:id` | Hard delete, and deletes the R2 object if present. |
| `GET /reports` | `?from=&to=&groupBy=category|month`. Both dates required; the client computes the range. Aggregated in SQL. |
| `POST /receipts` | Multipart upload → R2, returns `receiptKey`. |

`POST /reports` is absent deliberately — Reports are reads.

## The chat turn

1. Validate the request; append the user message.
2. If `receiptKey` is present, fetch the object and attach it to the model's message. If the upload already produced a Draft, the agent resumes that draft rather than creating a second one.
3. Call `LanguageModel.streamText({ prompt, toolkit })` from `effect/ai`. Tool calls are **resolved automatically** — `Tool.make` handlers run, results are appended, and `LanguageModel` validates each call against the tool's schema. Tools:
   - `search_categories()` — the closed list, so the model maps into it rather than inventing.
   - `propose_expense(amount, merchant, occurredAt, categoryName, note, needsReview)` — creates a Draft, returns its id.
   - `update_draft(id, fields)`
   - `discard_draft(id)`
   - `query_spending(from, to, groupBy)` — returns server-computed aggregates.
   - `get_expense(id)` — for rendering a card the user asked about.
   - **No confirm tool.** (ADR-0007.)
4. **Run the model again** if the response contains tool results rather than text. `streamText` resolves tools and returns; it does not re-call the model. The loop is ours, ~30 lines, with a step cap and a stop condition this app can state precisely: once a draft has been proposed and rendered, stop. Cap at 5 steps.
5. Let the model write OpenUI Lang as its text output. Components take ids, never values (ADR-0001).
6. Persist `content` (prose) and `ui_text` (the raw program). The assistant message is stored **as text**, not as a rendered snapshot: reload re-parses `ui_text` client-side with the current component library, at no model cost. If it no longer parses, the stored prose is shown instead. This is the same fallback path as a live parse failure, so it is one implementation rather than two.

## OpenUI component library

Four components in `packages/ui`, each a `defineComponent` with Zod 4 props:

| Component | Props |
|---|---|
| `DraftExpenseCard` | `id` |
| `ExpenseCard` | `id` |
| `ExpenseList` | `status`, `from?`, `to?`, optional `categoryId` |
| `SpendingChart` | `from`, `to`, `groupBy` (`category` \| `month`), `chartType` (`bar` \| `line`) |

Each fetches its own data with TanStack Query. `SpendingChart` renders Recharts; it computes nothing.

Wrap the default `openuiLibrary` with `.extend()` at module scope, or the Renderer re-parses on every render.

Streaming: accumulate text chunks into `response`, pass to `<Renderer response={response} isStreaming={isStreaming} library={lib} onAction={...} onError={...} />`.

**Failure path, part of the feature:** if `onError` reports a failed program or `root` is null, render the prose as plain text and offer one retry. `inlineMode: true` in the prompt options so questions with no UI answer ("how much did I spend last month?") come back as text rather than a forced chart.

**Actions:** `defineAction` for `ConfirmExpense` and `DiscardExpense`, handled in `onAction` by calling the API directly. `@ToAssistant` is not used for these — it would put the model in the confirmation path.

## Reports

`GET /reports` does the aggregation in SQL:

- `groupBy=category` → `SELECT c.name, SUM(e.amount) FROM expense e JOIN category c ... WHERE e.status='confirmed' AND e.occurred_at BETWEEN ? AND ? GROUP BY c.id`
- `groupBy=month` → `strftime('%Y-%m', occurred_at)`.

Negative amounts (refunds) fall out of `SUM` correctly. The agent receives the totals from `query_spending` and chooses the presentation; it never adds numbers up.

## Receipts

Client downscales before upload — DeepSeek caps images at 1,024 tokens regardless of resolution, so uploading a 12MP photo wastes bytes and loses nothing. Upload returns a key; the chat request carries it; the API fetches the bytes and sends them inline to the model. Serving is proxied through `GET /receipts/:key` behind the bearer token, not presigned.

## Slices

Each is shippable and testable on its own.

1. **Skeleton** — pnpm workspace, both apps booting, `alchemy dev`, `/health`, oxlint + oxfmt + `tsc -b` green in CI.
2. **Schema and seed** — migrations, category seed, `@effect/sql` repositories, integration tests in `@cloudflare/vitest-pool-workers` against a local D1 (`applyD1Migrations`).
3. **Expense CRUD** — routes, Effect Schema validation, list screen at `/expenses`. No AI yet. Proves the boring half works.
4. **Confirm flow** — `POST /expenses/:id/confirm`, idempotency test, optimistic update in the list.
5. **Model plumbing** — `LanguageModel` provided via `@effect/ai-openai-compat` pointed at DeepSeek's base URL. Prompt caching on the generated system prompt. A `POST /chat` that echoes text with no UI, and the tool-call loop with a step cap.
6. **OpenUI integration + eval** — component library, renderer, error path, plain-text fallback, and the **eval harness**: a script that runs 100 generations against the real four-component library and asserts each parses and renders. Deliverables: the harness, a recorded pass rate, and a failure-mode breakdown (no root / reference graph / type mismatch / truncation). This is the gate — it is the only measurement of whether this price tier holds the DSL, and it must run before more components are written.
7. **Drafts from chat** — tools, `DraftExpenseCard`, confirmation through the card.
8. **Reports** — `/reports` aggregation, `SpendingChart`, `query_spending`.
9. **Receipts** — R2 upload, image to model, `needs_review`, photo on the card.
10. **Deploy** — `alchemy.run.ts` with the D1 database, R2 bucket, static assets and secrets, plus the first production migration.

Slices 1–4 have no AI dependency and should land first; if the eval in slice 6 fails, slices 1–5 are still a working expense tracker.

**Three things not to build**, because Effect provides them: an HTTP client for the model (`@effect/ai-openai-compat`), a tool schema/validation layer (`Tool.make` + Effect Schema), and a streaming response type (`LanguageModel.streamText` returns a `Stream`). The tool-call loop and the eval harness are the only harness-shaped work that is ours.

## Open items

- **DeepSeek DSL adherence is unmeasured.** No published benchmark covers this price tier. Slice 6's eval is the gate; the fallback is Gemini 3.1 Flash-Lite behind the same `LanguageModel` service, since swapping provider is a `Layer` change.
- **Free-plan CPU budget for `POST /chat` is unmeasured.** Waiting on the model or D1 doesn't count against it, but parsing the streamed response does. Measure it during slice 6. If it goes over, the fix is Workers Paid ($5/month), not a code change.
- **Backups** are D1 Time Travel (7 days free, 30 paid) and `wrangler d1 export`. Note it in the README.
- **Chat history rendering** degrades if a component is later removed: `ui_text` is stored, so re-render can fail. The fallback in the chat turn is what covers it.
