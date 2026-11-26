# OpenUI Lang eval — can the model hold the DSL?

Issue #11's gate (ADR-0006, ADR-0008): before more components are built, run 100 generations
against the real component library and record the pass rate and how the failures fail.

## What it measures

`apps/api/scripts/eval-openui.ts` runs each generation as one Chat turn exactly as the Worker
sends it: the system prompt generated from `@expense/ui` (`inlineMode: true`), the same prompt
shape (`buildPrompt`), the same agent loop and stop condition (`draftsShown`), the same tool
definitions (`ChatToolkit`) and the same provider Layer (`ModelProviderLive`). The model calls
the tools itself, so the eval measures the whole tool-calling turn, not a program written from
results handed to it. Only the handlers differ: they answer from the scenario's in-memory
ledger, so the eval runs in Node with no D1. They keep the rules a model can trip on (the closed
Category set; only Drafts can be updated or discarded) and give `query_spending` the scenario's
canned figures. Twelve scenarios (`evalCases` in `apps/api/scripts/openui/OpenUiEval.ts`) are
cycled to make up the 100; one that refers back to an earlier card carries that exchange as Chat
history. A card may show only an id that exists: one in the scenario's ledger, or one
`propose_expense` returned in the turn.

Each reply is graded by `checkProgram` from `@expense/ui`, the shared validator:

| Outcome | Meaning | Pass? |
|---|---|---|
| `ok` | A program that parses cleanly and shows only ids a tool returned | yes, unless the case wanted prose |
| `prose` | No program at all | yes, unless the case wanted UI |
| `no-root` | Statements, but no `root` | no |
| `reference-graph` | A name used but never defined, or defined but never reached from `root` | no |
| `type-mismatch` | A component the parser dropped: wrong enum, missing or extra argument, unknown component | no |
| `truncation` | The program stops midway, or the model hit its output limit | no |
| `invented-id` | Valid, but a card shows an id no tool returned (ADR-0001) | no |
| `prose-instead-of-ui` | The case needed a component; the model only wrote prose | no |
| `forced-ui` | The case was a plain question; the model rendered a component anyway | no |
| `model-error` | The provider call failed | no |

The parser drops an invalid child silently and still returns a root, so "root is not null" is
not a pass; `checkProgram` also reads `meta.errors`, `meta.unresolved`, `meta.orphaned` and
`meta.incomplete`.

## Running it

```sh
# The real run (writes the Results section below). Needs the provider key in the environment;
# the deployed Worker reads the same key from the Cloudflare Secrets Store.
API_PROVIDER_KEY=<deepseek key> node apps/api/scripts/eval-openui.ts

# Another provider or model:
API_PROVIDER_KEY=<key> node apps/api/scripts/eval-openui.ts --provider gemini
# Dry run: a scripted fake model, no network, no key; prints the report, writes nothing.
node apps/api/scripts/eval-openui.ts --fake
```

Options: `--generations 100`, `--concurrency 4`, `--model <name>`, `--out <file>`.

## Results

<!-- openui-eval:results:start -->
Not run yet. Run the real eval (above) to fill this section.
<!-- openui-eval:results:end -->

## CPU time of a real `/chat` turn

The free Workers plan allows 10 ms of CPU per request. Time spent waiting on the model's
network response does not count; what does is the work around it: decoding the request, the D1
queries, re-encoding the streamed chunks, and, from this ticket, splitting the reply into prose
and program once at the end (a line scan, no parse). The Worker imports the system prompt as a
pre-generated string (`@expense/ui/server`), so it never loads OpenUI or Zod and never generates
the prompt or parses a program; the client does that. This needs a real deploy to measure;
procedure:

1. Deploy (`pnpm deploy`) with the provider key in the Secrets Store.
2. Send ten turns that each render a program and ten that are prose only, e.g.
   `curl -N -H "authorization: Bearer $API_TOKEN" -H "content-type: application/json"
   -d '{"message":"chart my spending by category this month","clientDate":"2026-11-25"}'
   https://<worker-host>/api/chat`.
3. In the Cloudflare dashboard, open the Worker → Observability, filter to `POST /api/chat`,
   and read CPU time per invocation (median, p99 and max). Note which request was the cold
   start.
4. Record the numbers here against the 10 ms limit, with the date and the Worker version.

| Date | Version | Turns | Median CPU | p99 CPU | Max CPU (cold) | Within 10 ms? |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | not measured yet |
