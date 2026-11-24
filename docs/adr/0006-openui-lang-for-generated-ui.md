# OpenUI Lang for generated UI

The agent writes OpenUI Lang — a line-oriented DSL, `root = Stack([expenseCard])` — and the frontend renders it with `<Renderer response={text} isStreaming={...} />`. Rendering is one text stream, so the transport is a plain chunked response with no envelope or framing contract to get wrong.

Alternatives were rejected on concrete grounds. A2UI costs four to eight days, most of it writing components it does not ship, and its reference SDKs broke in most minor releases over the preceding eight months. json-render ships no charts and its `useUIStream` silently drops SSE `data:` frames, a failure mode with no error.

## Consequences

- The library supplies the parser, the streaming behaviour, the prompt generator and the component registry — **not the components**. Every card and the chart are ours to write, which also means the visual design is not constrained by a vendor's CSS.
- OpenUI requires Zod 4 for component props. Zod 4 appears there and nowhere else; Effect Schema is the contract everywhere else.
- Zod key order in `z.object(...)` is the positional-argument contract. Reordering a prop field silently mis-maps arguments. Do not reorder; regenerate the prompt if you must.
- Roughly 7% of first-pass generations fail validation, and a failed program renders blank. A plain-text fallback and a single retry on parse error are part of the feature, not polish.
- Install-time telemetry is on by default. `OPENUI_TELEMETRY_DISABLED=1` belongs in the repo's environment defaults.
