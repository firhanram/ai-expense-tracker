# Spec: AI expense tracker

Status: ready-for-agent
Read with: `GLOSSARY.md`, `docs/adr/`, `docs/PLAN.md`, `DESIGN.md`

## Problem Statement

Recording what I spend takes more effort than it's worth. An app asks me to pick a category from a dropdown, type a date, and confirm a number — for a Rp70.000 lunch. So I don't record it, and at the end of the month I have no idea where the money went. Spreadsheets have the same cost; bank apps show me transactions but not what they meant.

What I already have is a sentence. "Bought cloth 70rb." Or a photo of a receipt. Turning that into a record is the work I want removed.

And when I do ask "how much did I spend on food this month?", I want an answer I can see — a number and a shape — not three paragraphs of prose I have to read and trust.

## Solution

A chat. I type what I spent, or paste a photo of the receipt. The agent decides the Category, proposes a Draft Expense, and shows it to me as a card with the amount, merchant, date and photo. I press Confirm. That's the whole flow.

Because it's my money, the agent never confirms anything. It proposes; the button commits. A wrong amount is something I see and reject, never something that gets recorded.

Asking a question gets an answer in kind: a Report question returns a chart of server-computed figures, not the model's arithmetic. And because everything I've ever recorded is in the chat plus a plain list, fixing a mistake from three weeks ago means editing a row, not arguing with a model.

## User Stories

**Recording**

1. As the user, I want to type "buy cloth 70rb" and get a Draft Expense back, so that recording spending costs one sentence.
2. As the user, I want the agent to assign a Category without asking me, so that I never fill in a form.
3. As the user, I want the amount, merchant and date to be inferred from my sentence, so that I only supply what I already know.
4. As the user, I want to confirm with a button, so that a model mistake can never become a record.
5. As the user, I want to discard a Draft Expense, so that a misread sentence doesn't leave clutter.
6. As the user, I want to undo a discard for a few seconds afterwards, so that a misclick costs nothing.
7. As the user, I want to correct the amount, Category, merchant, note or date on a Draft before confirming, so that the agent being wrong costs one edit rather than a retype.
8. As the user, I want a corrected Draft to be what gets recorded, so that my version wins over the agent's guess.
9. As the user, I want to record more than one expense in a row without the previous one being lost, so that a burst of morning purchases is one session.
10. As the user, I want one sentence naming two purchases ("coffee 20rb and parking 5rb") to produce two Drafts, so that I don't have to split my own sentence.
11. As the user, I want to pick the date before sending ("Today ▾"), so that recording yesterday's spending doesn't depend on phrasing.
12. As the user, I want a refund recorded as a negative amount in the original Category, so that Reports net out instead of double-counting.
13. As the user, I want to add an Expense by hand without the agent, so that I'm not blocked when chatting is the wrong tool.

**Receipts**

14. As the user, I want to attach a photo of a receipt and have a Draft Expense extracted from it, so that I don't retype a total.
15. As the user, I want to see the photo on the Draft card next to the extracted amount, so that I can check the agent read it correctly.
16. As the user, I want to attach a photo by drag-drop, paste or file picker, so that it works however I have the image.
17. As the user, I want an unreadable receipt to still produce a Draft I can fill in, so that a bad photo doesn't leave me with an error and no record.
18. As the user, I want a Draft the agent wasn't confident about to be visually marked, so that I know to check it.
19. As the user, I want the photo to disappear when I delete the Expense, so that nothing of mine lingers in storage.

**Reports**

20. As the user, I want to ask "report of my expenses" and get a chart, so that I understand the month at a glance.
21. As the user, I want to ask "how much did I spend on food last month" and get a number with a chart, so that the answer matches the question.
22. As the user, I want the figures computed by the server, so that they're never wrong because a model added them up.
23. As the user, I want to see spending by Category, so that I can find the one that's out of line.
24. As the user, I want to see spending over months, so that I can see whether it's a trend or a blip.
25. As the user, I want Report ranges sent as explicit dates from the client, so that "this month" means my month, not a server's.
26. As the user, I want to ask a question with no chart answer ("did I already record the parking?") and get prose, so that not every reply is forced into a diagram.
27. As the user, I want Reports to include only confirmed Expenses, so that a Draft I haven't approved doesn't affect my totals.

**Chat**

28. As the user, I want one continuous conversation, so that I never choose or name a thread.
29. As the user, I want my history preserved across reloads, so that I can scroll back to what I recorded last week.
30. As the user, I want past assistant messages to render as UI again after a reload, so that history looks like it did when it happened.
31. As the user, I want a past message that can no longer render to degrade to its text, so that history doesn't break when components change.
32. As the user, I want the reply to appear as it streams, so that I'm not staring at a spinner.
33. As the user, I want to see which of my sentences produced which Draft, so that I can connect cause and effect.
34. As the user, I want to send a new message while a reply is streaming, so that the app never feels stuck.
35. As the user, I want Enter to send and Shift+Enter to add a line, so that typing behaves like a messenger.
36. As the user, I want example prompts when the conversation is empty, so that I know what it can do.

**Audit and repair**

37. As the user, I want a list of my Expenses, so that I can audit without scrolling chat.
38. As the user, I want to filter the list by month and Category, so that I can find one specific mistake.
39. As the user, I want to edit a confirmed Expense, so that a wrong Category from three weeks ago is fixable.
40. As the user, I want to delete an Expense, so that a duplicate can be removed.
41. As the user, I want to see which Expenses have a Receipt, so that I can find the ones I can verify.

**Reliability**

42. As the user, I want a failed UI generation to fall back to readable text with a retry, so that a bad parse isn't a blank screen.
43. As the user, I want double-pressing Confirm to record one Expense, so that a slow network doesn't duplicate my money.
44. As the user, I want retrying a failed message to not create a second Draft, so that a flaky connection doesn't duplicate my money either.
45. As the user, I want the app to tell me when the agent can't reach the model, so that I know the difference between "nothing to say" and "broken".
46. As the user, I want my data in a file I can copy, so that a backup is possible.

**Operation**

47. As the operator, I want the app runnable locally with no Docker and no cloud account, so that cloning the repo is enough.
48. As the operator, I want the model provider swappable by configuration, so that a provider failure isn't a rewrite.

**Access**

49. As the owner, I want to sign in with a passkey, so that nobody else can open my expenses and I never type a password.
50. As the owner, I want registering a passkey to require my signed-in session or the setup token, so that finding the URL is never enough to take the app over.
51. As the owner, I want to stay signed in for weeks on my own devices, so that opening the app to record a Rp20.000 coffee costs no extra step.
52. As the owner, I want to see my passkeys and remove one, so that a lost device can be revoked.
53. As the owner, I want a way back in if I lose every device, so that losing a phone doesn't lose my data.

## Implementation Decisions

**Domain.** Vocabulary is fixed by `GLOSSARY.md`: Expense, Draft Expense, Receipt, Category, Report, Chat. `status` covers draft, confirmed and discarded on one table — confirmation is a transition, not a copy (ADR-0002).

**Status transitions.** Every write route checks the current status. Repeating a transition that already happened returns `200` with the current record, so retries are safe; a transition that makes no sense returns `409`.

| Action | from `draft` | from `confirmed` | from `discarded` |
|---|---|---|---|
| confirm | → `confirmed` | `200`, no change | `409` |
| discard | → `discarded` | `409` | `200`, no change |
| restore | `200`, no change | `409` | → `draft` |
| edit (`PATCH`) | allowed | allowed | `409` |
| delete | allowed | allowed | allowed |

**Money.** Integer whole Rupiah, no minor unit, no currency column. Format with `Intl.NumberFormat('id-ID')` (ADR-0003). An amount of `0` is a validation error.

**Categories.** Eleven seeded rows referenced by FK, in the order and with the boundaries listed in ADR-0004. Each row has a stable `slug` (`utilities`) as well as a display name; the model, the API and stored OpenUI Lang refer to Categories by slug, so a rename never breaks history. The agent assigns from the closed set and cannot create; unmatched spending lands in `other`.

**Generated UI.** The agent writes OpenUI Lang; the frontend renders it with OpenUI's `Renderer`. The library supplies the parser, prompt generator and component registry — not the components. Four components are ours: `DraftExpenseCard`, `ExpenseCard`, `ExpenseList`, `SpendingChart` (ADR-0006).

**Components take ids, never values.** Every rendered card receives an id and fetches its own record. A hallucinated amount cannot reach the screen, and a confirmed card updates without a second model call (ADR-0001). Chart components take a date range and a grouping, not numbers.

**Confirmation is not a tool.** The agent's tools create, read, edit and discard. None confirms. Confirmation is the button, which calls the API directly (ADR-0007).

**Dates.** `occurred_at` is a date with no time. The server never works out a calendar date on its own: every chat turn carries `clientDate` (the user's today, used to resolve "yesterday") and every Report carries `from`/`to` (ADR-0009). A chat turn may also carry `defaultDate`, the date picked in the composer, which a Draft takes when the sentence names no date. An `occurred_at` later than `clientDate` is a validation error. Timestamps such as `created_at` use the server clock; that is not calendar arithmetic.

**Model.** One model — DeepSeek via `@effect/ai-openai-compat` — for both receipt extraction and UI generation (ADR-0008). `LanguageModel` is a service from `effect/ai`, so the provider is a `Layer` swap. `@effect/ai` must not be installed; it is v3-only. Each model call has a 30-second timeout and is retried up to twice, only if no output has been received yet; a retry after streaming has begun would duplicate text.

**Prompt.** The system prompt is the generated component prompt plus the eleven Categories (slug, name and boundary notes) and is byte-identical on every turn, so the provider's prefix cache hits. Anything that varies per turn — `clientDate`, `defaultDate`, the receipt — goes in the user message, never the system prompt. The model sees the most recent 20 messages of history, not the whole conversation; past cards are ids, so this stays small.

**Agent loop.** `LanguageModel.streamText` resolves tool calls and returns; it does not re-call the model. The loop is ours: call again while the response contains tool results, and stop when the model returns text with no tool calls, or after five steps. One sentence may produce several Drafts. The tools are `propose_expense`, `update_draft`, `discard_draft`, `query_spending` and `get_expense`; the Category argument is a literal union of the eleven slugs, so `LanguageModel`'s schema validation rejects an invented Category before the handler runs.

**One turn at a time.** The server processes chat turns sequentially; a second `POST /chat` waits for the first to finish rather than interleaving with it. The client also queues, so this is a guard, not the normal path.

**Retry-safe turns.** `POST /chat` carries a client-generated `messageId`. A repeated `messageId` does not run the turn again: it returns the stored result if the turn completed, or `409` if it is still running. This makes the Retry button and network retries unable to create a second Draft.

**Draft provenance.** Each Draft records the user message that produced it (`source_message_id`), so the UI can connect a sentence to its Drafts. A Receipt attached to a turn is bound by the server to the first Draft proposed in that turn; the model never handles receipt keys.

**API surface.** `POST /chat` (streaming), `GET /chat`, `GET|POST /expenses`, `PATCH /expenses/:id`, `POST /expenses/:id/confirm`, `POST /expenses/:id/discard`, `POST /expenses/:id/restore`, `DELETE /expenses/:id`, `GET /reports`, `POST /receipts`, `GET /receipts/:key`, plus the `/auth/*` routes below. Reports are reads with explicit `from`/`to`, both inclusive.

**Access.** One owner, passkeys only, no sign-up (ADR-0010).

- Every route except `/auth/*` and `/health` requires a session and returns `401` without one. The open routes are an explicit list; everything else is protected by default.
- Registering a passkey requires a valid session **or** the `SETUP_TOKEN` environment secret. With no session and no `SETUP_TOKEN` configured, registration returns `403`. The owner deletes `SETUP_TOKEN` after the first passkey exists; setting it again is the recovery path if every device is lost.
- Passkeys are discoverable credentials with `userVerification: "required"`, so sign-in needs no username and always needs the owner's face, fingerprint or device PIN.
- A session is 32 random bytes in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie; the database stores its SHA-256 hash. Sessions last 30 days and renew on use.
- State-changing requests whose `Origin` header is not the app's own origin are rejected.
- Setup-token attempts are limited to five per minute and compared in constant time.
- Removing the last remaining passkey returns `409`.
- WebAuthn challenges are held in memory for five minutes and used once; this relies on the single instance (ADR-0005).
- The SPA and the API are served from one origin, so the cookie needs no cross-site configuration and receipt images authenticate like any other request.
- The relying-party id is the production domain, configured explicitly. A passkey made on another domain will not work there.

**Chat stream.** The response body is the model's text — prose and OpenUI Lang — as it arrives, followed by one terminal control line that says whether the turn completed or failed and why (`model_unreachable`, `step_limit`). The client strips that line before rendering. Without it, a stream cut short by an error is indistinguishable from a short reply (ADR-0006).

**Chat persistence.** The user message is stored when the turn starts. The assistant message is stored only when the turn completes, as prose and the raw OpenUI Lang text, split by the same parser the client uses. Reload re-parses locally; a parse failure falls back to the stored prose. This is the same path as a live parse failure, so it is one implementation. `GET /chat` pages backwards with a cursor ("messages before id X"); ids are time-ordered (UUIDv7), so the cursor needs no extra index.

**Storage.** Receipts in R2 behind the API, not presigned. The client downscales before upload because the model caps images at 1,024 tokens regardless of resolution; the server rejects anything that is not an image or is over 5 MB. Deleting an Expense deletes its row first and then its object, best-effort. On startup the server deletes objects that no Expense references and that are more than a day old, which covers both failed deletes and uploads that were never sent. Discarded Drafts keep their Receipt, so Undo restores the photo too.

**Database.** SQLite with `foreign_keys = ON`, `journal_mode = WAL` and a `busy_timeout`, set on every connection. SQLite ignores foreign keys unless told otherwise.

**Backups.** A backup is `VACUUM INTO` a new file, never a copy of the live file: copying a database in WAL mode can produce a corrupt copy. One is taken automatically before migrations run on deploy.

**Deployment.** One Effect v4 service on Railway with SQLite on a volume, serving both the API and the built Vite SPA from one origin, declared in Alchemy (ADR-0005). One instance only — volumes don't attach across services. `SETUP_TOKEN` and the relying-party id are deployment secrets.

## Testing Decisions

A good test asserts externally observable behaviour: a route's response, a row's state, a component's rendered output. It does not assert which internal function ran, or the shape of a private helper. If a test breaks when a function is renamed but behaviour is identical, it was testing the wrong thing.

Three seams, all chosen high:

**S1 — the HTTP boundary.** The Effect `HttpApp` is invoked in-process; no socket, no server boot. This is where nearly all server behaviour is tested: request validation, status codes, every non-`/auth` route returning `401` without a session (enumerated from the router, so a new route is covered automatically), registration refused without a session or the setup token, removal of the last passkey refused, an expired session rejected, every cell of the status-transition table, idempotency of confirm and of a repeated chat `messageId`, rejection of a future `occurred_at`, hard delete removing the row, and Report aggregation sums including inclusive range ends.

**S2 — the `LanguageModel` service.** Effect exposes the model as a `Context.Tag`, so a hand-written fake drives the entire chat turn with no network and no API key. This is where agent behaviour is tested: does "buy cloth 70rb" produce a `propose_expense` call with a Category slug from the seeded set; does "coffee 20rb and parking 5rb" produce two Drafts; does the loop stop on a text-only response; does the five-step cap hold; is the confirm tool absent from the toolkit; does a failure before first output end the stream with a `model_unreachable` control line. Deterministic, because the model is a value the test supplies.

**S3 — renderer parse.** Given OpenUI Lang text, does it parse and mount? Property-shaped: every component in the library round-trips through prompt generation and parse. No server, no model.

**Not tested with a real model in CI.** A live-model test is slow, non-deterministic and costs money. The 100-generation eval harness (slice 6) runs on demand and records its result; CI tests the fake.

**Prior art.** None in this repo — it is greenfield. The pattern to follow is Effect's own `Layer`-substitution style: provide a test Layer, assert on the effect's result.

## Out of Scope

- Multiple users, accounts or sharing. One owner.
- Passwords, email sign-in, OAuth, or any second way to sign in. Passkeys only.
- Budgets, alerts, recurring expenses, scheduled imports.
- Bank or card integration.
- Multi-currency and FX. One currency, no conversion.
- Income tracking as a first-class concept; a refund is a negative Expense.
- Splitting a receipt into several Expenses. One receipt, one Draft.
- Editing Categories through the UI; the seed is code.
- Future-dated Expenses.
- Push notifications, email digests, exports beyond the `VACUUM INTO` backup file.
- Search across chat history.
- Mobile or desktop apps. One responsive web app.
- Migrating off SQLite while the app runs on one instance.
- A generative-UI library swap. OpenUI is recorded as the choice in ADR-0006.

## Further Notes

**Unmeasured risk.** No published benchmark covers DeepSeek's price tier for OpenUI Lang adherence. The eval in slice 6 is the measurement; if it fails, Gemini Flash-Lite is the fallback and it is a `Layer` change. Do not let this be discovered after the components are built. Slice 6 should also confirm that the OpenUI parser can split a completed response into prose and program on the server, which chat persistence relies on.

**Deliberate imbalance.** The AI is the interesting half and the least certain. Slices 1–4 are the expense tracker with no model at all; they should land first, so a model failure leaves a working app rather than a broken demo.

**One instance, permanently.** Railway volumes do not attach across services, so there is no horizontal scaling and no zero-downtime deploy. This is accepted for personal data, and it is the thing to revisit first if requirements change. It is also what makes sequential chat turns an in-process lock rather than a distributed one.

**Backups are a file.** No point-in-time recovery. State it in the README so a stranger cloning the repo knows the trade.
