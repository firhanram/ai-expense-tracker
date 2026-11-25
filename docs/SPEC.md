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
6. As the user, I want to correct the amount, Category, merchant, note or date on a Draft before confirming, so that the agent being wrong costs one edit rather than a retype.
7. As the user, I want a corrected Draft to be what gets recorded, so that my version wins over the agent's guess.
8. As the user, I want to record more than one expense in a row without the previous one being lost, so that a burst of morning purchases is one session.
9. As the user, I want a refund recorded as a negative amount in the original Category, so that Reports net out instead of double-counting.
10. As the user, I want to add an Expense by hand without the agent, so that I'm not blocked when chatting is the wrong tool.

**Receipts**

11. As the user, I want to attach a photo of a receipt and have a Draft Expense extracted from it, so that I don't retype a total.
12. As the user, I want to see the photo on the Draft card next to the extracted amount, so that I can check the agent read it correctly.
13. As the user, I want to attach a photo by drag-drop, paste or file picker, so that it works however I have the image.
14. As the user, I want an unreadable receipt to still produce a Draft I can fill in, so that a bad photo doesn't leave me with an error and no record.
15. As the user, I want a Draft the agent wasn't confident about to be visually marked, so that I know to check it.
16. As the user, I want the photo to disappear when I delete the Expense, so that nothing of mine lingers in storage.

**Reports**

17. As the user, I want to ask "report of my expenses" and get a chart, so that I understand the month at a glance.
18. As the user, I want to ask "how much did I spend on food last month" and get a number with a chart, so that the answer matches the question.
19. As the user, I want the figures computed by the server, so that they're never wrong because a model added them up.
20. As the user, I want to see spending by Category, so that I can find the one that's out of line.
21. As the user, I want to see spending over months, so that I can see whether it's a trend or a blip.
22. As the user, I want Report ranges sent as explicit dates from the client, so that "this month" means my month, not a server's.
23. As the user, I want to ask a question with no chart answer ("did I already record the parking?") and get prose, so that not every reply is forced into a diagram.
24. As the user, I want Reports to include only confirmed Expenses, so that a Draft I haven't approved doesn't affect my totals.

**Chat**

25. As the user, I want one continuous conversation, so that I never choose or name a thread.
26. As the user, I want my history preserved across reloads, so that I can scroll back to what I recorded last week.
27. As the user, I want past assistant messages to render as UI again after a reload, so that history looks like it did when it happened.
28. As the user, I want a past message that can no longer render to degrade to its text, so that history doesn't break when components change.
29. As the user, I want the reply to appear as it streams, so that I'm not staring at a spinner.
30. As the user, I want to see which of my sentences produced which Draft, so that I can connect cause and effect.
31. As the user, I want to send a new message while a reply is streaming, so that the app never feels stuck.
32. As the user, I want Enter to send and Shift+Enter to add a line, so that typing behaves like a messenger.
33. As the user, I want example prompts when the conversation is empty, so that I know what it can do.

**Audit and repair**

34. As the user, I want a list of my Expenses, so that I can audit without scrolling chat.
35. As the user, I want to filter the list by month and Category, so that I can find one specific mistake.
36. As the user, I want to edit a confirmed Expense, so that a wrong Category from three weeks ago is fixable.
37. As the user, I want to delete an Expense, so that a duplicate can be removed.
38. As the user, I want to see which Expenses have a Receipt, so that I can find the ones I can verify.

**Reliability**

39. As the user, I want a failed UI generation to fall back to readable text with a retry, so that a bad parse isn't a blank screen.
40. As the user, I want double-pressing Confirm to record one Expense, so that a slow network doesn't duplicate my money.
41. As the user, I want the app to tell me when the agent can't reach the model, so that I know the difference between "nothing to say" and "broken".
42. As the user, I want my data in a file I can copy, so that a backup is possible.

**Operation**

43. As the operator, I want one bearer token protecting the API, so that a deployed instance isn't public.
44. As the operator, I want the app runnable locally with no Docker and no cloud account, so that cloning the repo is enough.
45. As the operator, I want the model provider swappable by configuration, so that a provider failure isn't a rewrite.

## Implementation Decisions

**Domain.** Vocabulary is fixed by `GLOSSARY.md`: Expense, Draft Expense, Receipt, Category, Report, Chat. `status` covers draft, confirmed and discarded on one table — confirmation is a transition, not a copy (ADR-0002).

**Money.** Integer whole Rupiah, no minor unit, no currency column. Format with `Intl.NumberFormat('id-ID')` (ADR-0003).

**Categories.** Eleven seeded rows referenced by FK. The agent assigns from the closed set and cannot create; unmatched spending lands in `Other` (ADR-0004).

**Generated UI.** The agent writes OpenUI Lang; the frontend renders it with OpenUI's `Renderer`. The library supplies the parser, prompt generator and component registry — not the components. Five components are ours: `DraftExpenseCard`, `ExpenseCard`, `ExpenseList`, `SpendingChart` (ADR-0006).

**Components take ids, never values.** Every rendered card receives an id and fetches its own record. A hallucinated amount cannot reach the screen, and a confirmed card updates without a second model call (ADR-0001). Chart components take a date range and a grouping, not numbers.

**Confirmation is not a tool.** The agent's tools create, read, edit and discard. None confirms. Confirmation is the button, which calls the API directly (ADR-0007). The confirm endpoint is idempotent.

**Dates.** `occurred_at` is a date with no time. The client sends its own date; the server never reads the clock (ADR-0009).

**Model.** One model — DeepSeek via `@effect/ai-openai-compat` — for both receipt extraction and UI generation (ADR-0008). `LanguageModel` is a service from `effect/ai`, so the provider is a `Layer` swap. `@effect/ai` must not be installed; it is v3-only.

**Agent loop.** `LanguageModel.streamText` resolves tool calls and returns; it does not re-call the model. The loop is ours, capped at five steps, terminating once a Draft has been proposed and rendered.

**API surface.** `POST /chat` (streaming), `GET /chat`, `GET|POST /expenses`, `PATCH /expenses/:id`, `POST /expenses/:id/confirm`, `POST /expenses/:id/discard`, `DELETE /expenses/:id`, `GET /reports`, `POST /receipts`, `GET /receipts/:key`. Reports are reads with explicit `from`/`to`.

**Chat persistence.** Each assistant message stores prose and the raw OpenUI Lang text. Reload re-parses locally; a parse failure falls back to the stored prose. This is the same path as a live parse failure, so it is one implementation.

**Storage.** Receipts in R2 through a Worker binding, served by the API, not presigned. Client downscales before upload because the model caps images at 1,024 tokens regardless of resolution.

**Deployment.** One Cloudflare Worker, declared in Alchemy, serves the Vite SPA as static assets and forwards `/api/*` to a single Durable Object. That object runs the Effect v4 `HttpApp` on its own SQLite storage (`@effect/sql-sqlite-do`) (ADR-0010). One database only, because all state lives in one object.

## Testing Decisions

A good test asserts externally observable behaviour: a route's response, a row's state, a component's rendered output. It does not assert which internal function ran, or the shape of a private helper. If a test breaks when a function is renamed but behaviour is identical, it was testing the wrong thing.

Three seams, all chosen high:

**S1 — the HTTP boundary.** The Effect `HttpApp` is called in workerd through `@cloudflare/vitest-pool-workers`, against a real Durable Object. There is no socket and no deploy. This is where nearly all server behaviour is tested: request validation, bearer auth, status codes, the draft→confirmed transition, idempotency of confirm, hard delete removing the row, and Report aggregation sums. Because it is one seam, a change to any repository or handler is covered by tests that never mention them.

**S2 — the `LanguageModel` service.** Effect exposes the model as a `Context.Tag`, so a hand-written fake drives the entire chat turn with no network and no API key. This is where agent behaviour is tested: does "buy cloth 70rb" produce a `propose_expense` call with a Category from the seeded set; does the loop terminate after a draft rather than looping; does a five-step cap hold; is the confirm tool absent from the toolkit. Deterministic, because the model is a value the test supplies.

**S3 — renderer parse.** Given OpenUI Lang text, does it parse and mount? Property-shaped: every component in the library round-trips through prompt generation and parse. No server, no model.

**Not tested with a real model in CI.** A live-model test is slow, non-deterministic and costs money. The 100-generation eval harness (slice 6) runs on demand and records its result; CI tests the fake.

**Prior art.** None in this repo — it is greenfield. The pattern to follow is Effect's own `Layer`-substitution style: provide a test Layer, assert on the effect's result.

## Out of Scope

- Multiple users, accounts, sessions or sharing. One implicit owner, one bearer token.
- Budgets, alerts, recurring expenses, scheduled imports.
- Bank or card integration.
- Multi-currency and FX. One currency, no conversion.
- Income tracking as a first-class concept; a refund is a negative Expense.
- Splitting a receipt into several Expenses. One receipt, one Draft.
- Editing Categories through the UI; the seed is code.
- Push notifications, email digests, exports beyond a table dump.
- Search across chat history.
- Mobile or desktop apps. One responsive web app.
- Migrating off Durable Object SQLite while one database is enough.
- A generative-UI library swap. OpenUI is recorded as the choice in ADR-0006.

## Further Notes

**Unmeasured risk.** No published benchmark covers DeepSeek's price tier for OpenUI Lang adherence. The eval in slice 6 is the measurement; if it fails, Gemini Flash-Lite is the fallback and it is a `Layer` change. Do not let this be discovered after the components are built.

**Deliberate imbalance.** The AI is the interesting half and the least certain. Slices 1–4 are the expense tracker with no model at all; they should land first, so a model failure leaves a working app rather than a broken demo.

**One database, permanently.** All state lives in one Durable Object, so there is exactly one writer. This is accepted for personal data, and it is the first thing to revisit if requirements change.

**Backups are point-in-time recovery.** Durable Object SQLite keeps 30 days of PITR. There is no file to copy, so an export means a table dump. State it in the README so a stranger cloning the repo knows the trade.
