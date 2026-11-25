# One cheap vision model for both receipts and generated UI

A single model — DeepSeek `deepseek-flash` (DeepSeek-V4.1-Flash) — reads receipt images and writes OpenUI Lang. There is no dedicated OCR tier in front of it.

Note the model name: `deepseek-chat` and `deepseek-reasoner` were retired on 2026-07-24, and `deepseek-vl2` is open weights only and never had an API. `deepseek-flash` is the only DeepSeek model with vision.

A dedicated document parser costs 7× (Mistral OCR, $2.00/1k pages) to 330× (Google Document AI, $100/1k pages) more per receipt than a general vision model, and buys resistance to one specific failure: fabrication on faded thermal paper. That failure is already absorbed structurally — extraction produces a Draft Expense (ADR-0002) that the user sees, and confirmation is a button press (ADR-0007). A hallucinated total is displayed and rejected, not recorded. Paying 300× to improve a guess the user reviews anyway is the wrong trade.

## Consequences

- Receipt images are capped at 1,024 input tokens each by DeepSeek regardless of resolution. This is the most predictable vision cost of any provider, but it means a photographed receipt is downscaled server-side. Small print may be lost; the draft card shows the photo so the user can check.
- DeepSeek's JSON mode has no schema parameter, and its documented failure mode is returning empty `content` with `finish_reason: stop`. Do not rely on it. OpenUI Lang is plain text, so the DSL path needs no structured-output mode.
- Schema-constrained output would be a reason to choose a different provider. The `AiProvider` port exists so that is a Layer swap, not a refactor.
- Pricing is time-of-day dependent (off-peak roughly half). Irrelevant at this volume: the entire app costs well under a dollar per month, and the spread between the cheapest and a mid-tier model is about three dollars a month. Cost is not the deciding variable.
- Caching the generated system prompt matters more than model choice: roughly 5k tokens per chat turn dominates input spend, and a cache hit is ~45× cheaper than a miss.
- No model in this price tier has published DSL-adherence numbers. The published benchmarks are frontier models only. Build a small eval against the real component library before wiring the UI, rather than after.
