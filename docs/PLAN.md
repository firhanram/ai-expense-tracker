# Implementation plan

A chat-first expense tracker. The agent proposes Draft Expenses and renders its answers as UI; the user confirms with a button. Deployed to Railway by Alchemy.

Read alongside `GLOSSARY.md` and `docs/adr/`. Where this plan and an ADR disagree, the ADR wins.

## Runtime shape

One Railway service, declared in `alchemy.run.ts`:

- **`apps/api`** — Effect v4 HTTP service on Node, SQLite file on a Railway volume, talks to the model and to R2.
- **`apps/web`** — Vite SPA. Its build output is served by `apps/api` as static files, so the SPA and the API share one origin and one session cookie (ADR-0010). The API lives under `/api`; everything else falls through to the SPA.
- **R2** — bucket for receipt images. Not on Railway; S3 client over the public internet.
- **Alchemy** — `alchemy deploy` for the service and the bucket. `alchemy dev` for local work; no Docker.

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
| SQL | `@effect/sql-sqlite-node` + `@effect/sql/Migrator` |
| Storage | `@effect-aws/client-s3` |
| UI generation | `@openuidev/react-lang`, `@openuidev/lang-core` |
| Frontend | React + Vite + TanStack Router + TanStack Query + `@ui-sdk/react` + Tailwind |
| Charts | Recharts, wrapped in our own component |
| Auth | `@simplewebauthn/server` + `@simplewebauthn/browser` (ADR-0010) |
| Validation | Effect Schema (API/DB), Zod 4 (OpenUI props only) |
| Toolchain | `typescript@7`, `oxlint --type-aware`, `oxfmt` |

No `@openuidev/react-ui` (it brings Radix, which duplicates ui-sdk), no `@effect/tsgo` (needs a patched native binary and drops musl).

**Do not install `@effect/ai`.** In v4 the AI modules live in `effect` itself (`effect/ai` exports `LanguageModel`, `Toolkit`, `Tool`, `Prompt`, `Response`). The standalone `@effect/ai` package tops out at 0.37.0 and peers on `effect ^3.22`, so adding it pulls a second, incompatible Effect. The provider packages (`@effect/ai-*@4.1.5`) peer directly on `effect ^4.1.5` and do not depend on that package.

There is no `@effect/ai-deepseek` provider, and there does not need to be: DeepSeek's API is OpenAI-compatible, so `@effect/ai-openai-compat` with a base-URL override is the client.

## Data

One SQLite file. Migrations via `@effect/sql/Migrator`, numbered SQL files.

```sql
CREATE TABLE category (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,         -- 'utilities'; what the model, API and ui_text use
  name        TEXT NOT NULL UNIQUE,         -- display name, free to rename
  sort_order  INTEGER NOT NULL              -- seeded order = chart colour order (ADR-0004)
);

CREATE TABLE expense (
  id           TEXT PRIMARY KEY,            -- UUIDv7, time-ordered
  amount       INTEGER NOT NULL             -- whole Rupiah, > 0 for outflow, < 0 for a refund
                 CHECK (amount <> 0),
  category_id  INTEGER NOT NULL REFERENCES category(id),
  merchant     TEXT,
  note         TEXT,
  occurred_at  TEXT NOT NULL,               -- 'YYYY-MM-DD', no time
  created_at   TEXT NOT NULL,               -- ISO 8601 UTC
  status       TEXT NOT NULL                -- 'draft' | 'confirmed' | 'discarded'
                 CHECK (status IN ('draft','confirmed','discarded')),
  needs_review INTEGER NOT NULL DEFAULT 0,
  receipt_key  TEXT,                         -- R2 object key, null if no receipt
  source_message_id TEXT                     -- the user chat_message that produced it; null if added by hand
                 REFERENCES chat_message(id)
);

CREATE INDEX expense_status_date ON expense(status, occurred_at);

CREATE TABLE passkey (
  id           TEXT PRIMARY KEY,             -- WebAuthn credential id, base64url
  public_key   BLOB NOT NULL,
  counter      INTEGER NOT NULL,             -- signature counter; a decrease is rejected
  transports   TEXT,                         -- JSON array from the browser
  name         TEXT NOT NULL,                -- "iPhone", "MacBook"; owner-editable
  created_at   TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE session (
  id_hash      TEXT PRIMARY KEY,             -- SHA-256 of the cookie value; the raw id is never stored
  passkey_id   TEXT NOT NULL REFERENCES passkey(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL                 -- 30 days, pushed forward on use
);

CREATE TABLE chat_message (
  id          TEXT PRIMARY KEY,             -- UUIDv7; for user turns, the client's messageId
  role        TEXT NOT NULL,                -- 'user' | 'assistant'
  content     TEXT NOT NULL,                -- prose shown in the bubble
  ui_text     TEXT,                         -- raw OpenUI Lang, null for user turns
  created_at  TEXT NOT NULL
);
```

The 11 seeded categories, in this order, are listed with their slugs and boundaries in ADR-0004: Groceries, Dining, Transport, Utilities, Housing, Shopping, Health, Entertainment, Education, Giving & family, Other.

Every connection sets `PRAGMA foreign_keys = ON`, `journal_mode = WAL` and `busy_timeout = 5000`. SQLite ignores the `REFERENCES` clauses above without the first.

`receipt_key` sits on `expense` rather than in its own table: a receipt belongs to one Draft Expense, and an upload that becomes nothing is deleted rather than kept (ADR-0002, and the round-5 decision).

## API

The API has no authentication of its own; access control belongs to the deployment.

| Route | Purpose |
|---|---|
| `POST /chat` | Streams a response. Body: `{ messageId, message, clientDate, defaultDate?, receiptKey? }`. Returns a text stream of prose and OpenUI Lang, ending with one control line. A repeated `messageId` returns the stored result, or `409` while that turn is still running. |
| `GET /chat` | The conversation, newest page first. `?before=<id>` for the next page. |
| `GET /expenses` | `?status=&from=&to=&category=<slug>`. Confirmed by default. |
| `POST /expenses` | Manual create, bypassing the agent. |
| `PATCH /expenses/:id` | Edit amount, category, merchant, note, date. Works on drafts and confirmed; `409` on discarded. |
| `POST /expenses/:id/confirm` | Draft → confirmed. Idempotent. |
| `POST /expenses/:id/discard` | Draft → discarded. Keeps the row and its Receipt. |
| `POST /expenses/:id/restore` | Discarded → draft. Backs the Undo on a discarded card. |
| `DELETE /expenses/:id` | Hard delete, and deletes the R2 object if present. |
| `GET /reports` | `?from=&to=&groupBy=category|month`. Both dates required and inclusive; the client computes the range. Aggregated in SQL. |
| `POST /receipts` | Multipart upload → R2, returns `receiptKey`. Images only, 5 MB max. |
| `GET /receipts/:key` | Proxies the image from R2. |

Auth routes, open without a session:

| Route | Purpose |
|---|---|
| `GET /auth/status` | `{ hasPasskey, signedIn }` — decides between the setup screen, the sign-in screen and the app. |
| `POST /auth/register/options` | Body `{ setupToken? }`. Requires a session or a matching `SETUP_TOKEN`; otherwise `403`. Returns WebAuthn creation options. |
| `POST /auth/register/verify` | Verifies the attestation, stores the passkey, starts a session if there wasn't one. |
| `POST /auth/login/options` | Returns WebAuthn request options for a discoverable credential. |
| `POST /auth/login/verify` | Verifies the assertion and counter, sets the session cookie. |
| `POST /auth/logout` | Deletes the session row and clears the cookie. |

Passkey management, session required:

| Route | Purpose |
|---|---|
| `GET /auth/passkeys` | Name, created and last-used dates, and which one this session used. |
| `PATCH /auth/passkeys/:id` | Rename. |
| `DELETE /auth/passkeys/:id` | Remove, and end its sessions. `409` if it is the last one. |

Everything else requires a session and returns `401` without one; the open set is `/auth/*` above (except passkey management) and `/health`. State-changing requests with a foreign `Origin` are rejected.

The full status-transition table (which action is allowed from which status, and what `200`/`409` mean) is in `docs/SPEC.md`.

`POST /reports` is absent deliberately — Reports are reads.

## The chat turn

1. Validate the request. If `messageId` already exists, return the stored result (or `409` if that turn is still running). Otherwise take the turn lock — one turn at a time — and append the user message.
2. Build the prompt: the system prompt (generated component prompt + the eleven Categories with slugs and boundaries, byte-identical every turn so the prefix cache hits), the last 20 messages, then the user message carrying `clientDate`, `defaultDate` and, if `receiptKey` is present, the image bytes fetched from R2.
3. Call `LanguageModel.streamText({ prompt, toolkit })` from `effect/ai`, with a 30-second timeout and up to two retries before any output has arrived. Tool calls are **resolved automatically** — `Tool.make` handlers run, results are appended, and `LanguageModel` validates each call against the tool's schema. Tools:
   - `propose_expense(amount, merchant, occurredAt, category, note, needsReview)` — `category` is a literal union of the eleven slugs. Creates a Draft with `source_message_id` set to this turn's message, attaches the turn's receipt to the first Draft of the turn, and returns its id. `occurredAt` falls back to `defaultDate`, then `clientDate`, and may not be later than `clientDate`.
   - `update_draft(id, fields)`
   - `discard_draft(id)`
   - `query_spending(from, to, groupBy)` — returns server-computed aggregates.
   - `get_expense(id)` — for rendering a card the user asked about.
   - **No confirm tool.** (ADR-0007.)
4. **Run the model again** if the response contains tool results rather than text. `streamText` resolves tools and returns; it does not re-call the model. The loop is ours, ~30 lines: stop when the model returns text with no tool calls, or after 5 steps. One sentence may propose several Drafts ("coffee 20rb and parking 5rb"), so the loop does not stop at the first.
5. Let the model write OpenUI Lang as its text output. Components take ids, never values (ADR-0001).
6. End the stream with one control line — completed, or failed with a reason (`model_unreachable`, `step_limit`) — which the client strips before rendering. Release the turn lock.
7. On completion only, persist `content` (prose) and `ui_text` (the raw program), split with the same OpenUI parser the client uses. A failed turn stores no assistant message. The assistant message is stored **as text**, not as a rendered snapshot: reload re-parses `ui_text` client-side with the current component library, at no model cost. If it no longer parses, the stored prose is shown instead. This is the same fallback path as a live parse failure, so it is one implementation rather than two.

## OpenUI component library

Four components in `packages/ui`, each a `defineComponent` with Zod 4 props:

| Component | Props |
|---|---|
| `DraftExpenseCard` | `id` |
| `ExpenseCard` | `id` |
| `ExpenseList` | `status`, `from?`, `to?`, optional `category` (slug) |
| `SpendingChart` | `from`, `to`, `groupBy` (`category` \| `month`) — horizontal bars by Category, vertical bars by month |

Each fetches its own data with TanStack Query. `SpendingChart` renders Recharts; it computes nothing.

Wrap the default `openuiLibrary` with `.extend()` at module scope, or the Renderer re-parses on every render.

Streaming: accumulate text chunks into `response`, pass to `<Renderer response={response} isStreaming={isStreaming} library={lib} onAction={...} onError={...} />`.

**Failure path, part of the feature:** if `onError` reports a failed program or `root` is null, render the prose as plain text and offer one retry. `inlineMode: true` in the prompt options so questions with no UI answer ("how much did I spend last month?") come back as text rather than a forced chart.

**Actions:** `defineAction` for `ConfirmExpense` and `DiscardExpense`, handled in `onAction` by calling the API directly. `@ToAssistant` is not used for these — it would put the model in the confirmation path.

## Reports

`GET /reports` does the aggregation in SQL:

- `groupBy=category` → `SELECT c.slug, c.name, SUM(e.amount) FROM expense e JOIN category c ... WHERE e.status='confirmed' AND e.occurred_at BETWEEN ? AND ? GROUP BY c.id`
- `groupBy=month` → `strftime('%Y-%m', occurred_at)`.

`BETWEEN` is inclusive at both ends, which is the contract. Groups with no spending are omitted; the client fills empty months on a month chart.

Negative amounts (refunds) fall out of `SUM` correctly. The agent receives the totals from `query_spending` and chooses the presentation; it never adds numbers up.

## Receipts

Client downscales before upload — DeepSeek caps images at 1,024 tokens regardless of resolution, so uploading a 12MP photo wastes bytes and loses nothing. The server still rejects non-images and anything over 5 MB. Upload returns a key; the chat request carries it; the API fetches the bytes and sends them inline to the model, and binds the key to the turn's first Draft itself. Serving is proxied through `GET /receipts/:key`, not presigned.

Deleting an Expense deletes the row, then the object, best-effort. On startup the API deletes objects older than a day that no Expense references — failed deletes and uploads that were never sent. Discarded Drafts keep their Receipt so Undo restores it.

## Slices

Each is shippable and testable on its own.

1. **Skeleton** — pnpm workspace, both apps booting, `alchemy dev`, `/health`, oxlint + oxfmt + `tsc -b` green in CI.
2. **Schema and seed** — migrations, category seed with slugs, connection pragmas, `@effect/sql` repositories, integration tests against a temp file.
3. **Expense CRUD** — routes, Effect Schema validation, list screen at `/expenses`. No AI yet. Proves the boring half works.
4. **Status flow** — confirm, discard and restore, every cell of the status-transition table tested, optimistic update in the list.
5. **Model plumbing** — `LanguageModel` provided via `@effect/ai-openai-compat` pointed at DeepSeek's base URL. Prompt caching on the generated system prompt. A `POST /chat` that echoes text with no UI, and the tool-call loop with a step cap.
6. **OpenUI integration + eval** — component library, renderer, error path, plain-text fallback, and the **eval harness**: a script that runs 100 generations against the real four-component library and asserts each parses and renders. Deliverables: the harness, a recorded pass rate, and a failure-mode breakdown (no root / reference graph / type mismatch / truncation). This is the gate — it is the only measurement of whether this price tier holds the DSL, and it must run before more components are written.
7. **Drafts from chat** — tools, `DraftExpenseCard`, confirmation through the card.
8. **Reports** — `/reports` aggregation, `SpendingChart`, `query_spending`.
9. **Receipts** — R2 upload, image to model, `needs_review`, photo on the card.
10. **Passkey auth** — the two tables, the auth routes, the session middleware with its explicit open-route list, the setup and sign-in screens, and the S1 test that walks every route without a cookie. Lands before deploy: nothing goes on a public URL unprotected.
11. **Deploy** — `alchemy.run.ts` with the volume mounted, secrets, `VACUUM INTO` backup before each migrate, first production migrate.

Slices 1–4 have no AI dependency and should land first; if the eval in slice 6 fails, slices 1–5 are still a working expense tracker.

**Three things not to build**, because Effect provides them: an HTTP client for the model (`@effect/ai-openai-compat`), a tool schema/validation layer (`Tool.make` + Effect Schema), and a streaming response type (`LanguageModel.streamText` returns a `Stream`). The tool-call loop and the eval harness are the only harness-shaped work that is ours.

## Open items

- **DeepSeek DSL adherence is unmeasured.** No published benchmark covers this price tier. Slice 6's eval is the gate; the fallback is Gemini 3.1 Flash-Lite behind the same `LanguageModel` service, since swapping provider is a `Layer` change.
- **Railway Buckets' S3 compatibility is unverified.** R2 sidesteps the question, so it does not block anything.
- **Backups** are a `VACUUM INTO` file, never a copy of the live database (a WAL-mode copy can be corrupt). No PITR. Acceptable for personal data; note it in the README so a stranger cloning the repo knows.
- **Chat history rendering** degrades if a component is later removed: `ui_text` is stored, so re-render can fail. The fallback in the chat turn is what covers it.
