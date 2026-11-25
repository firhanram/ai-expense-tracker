# Cheap vision LLM with custom-DSL adherence — provider survey

Researched 2026-11-25. All prices USD per 1M tokens unless stated. Every figure below is
quoted from an official pricing/docs page (URLs in each section).

**Scope of decision:** one model for (a) receipt image → amount/merchant/date/category, and
(b) chat turn → short OpenUI Lang program, plus (c) server-side tool/function calling.

---

## Headline: cost is not the deciding variable

At 50–200 receipts and a few hundred chat turns per month, **every viable candidate costs
between $0.07 and $3.29 per month**. The spread between the absolute cheapest and a
frontier-adjacent Flash model is about **$3/month**. Choose on receipt accuracy and DSL
reliability; the price column is noise. The section "9. Cost arithmetic" shows the working.

---

## 1. DeepSeek

**Vision via the official API: yes, but only on one model.**

- `deepseek-flash` (served by `DeepSeek-V4.1-Flash-1017`) — Vision ✓. The docs' feature matrix
  lists `Vision` as ✓ for flash and **"Not supported"** for `deepseek-v4-pro`.
- `deepseek-chat` and `deepseek-reasoner` — **retired 2026-07-24**. The changelog: *"The two
  legacy API model names, `deepseek-chat` and `deepseek-reasoner`, will be discontinued in
  three months (2026-07-24)."* Any 2025-era guide telling you to use them is dead.
- `deepseek-vl2` — **open weights only**. Not in the API model list; the HuggingFace repo
  exists. This is the classic trap: the VL2 family never became an API model.
- There was an experimental `deepseek-v4-flash-vision-exp` (released 2026-08-21), now retired
  and routed to V4.1 Flash for compatibility.

**Pricing** (api.deepseek.com, cache-miss / output; off-peak is half of peak; peak = 01:00–04:00
and 06:00–10:00 UTC Mon–Fri):

| Model | Input (cache miss) | Output | Input (cache hit) |
|---|---|---|---|
| `deepseek-flash` off-peak | **$0.15** | **$0.60** | $0.003 |
| `deepseek-flash` peak | $0.30 | $1.20 | $0.006 |
| `deepseek-v4-pro` off-peak | $0.66 | $1.98 | $0.022 |

**Image token cost is capped at 1,024 tokens per image.** Docs: images are resized so that total
pixel count is "roughly that of a **1300×1300** image", giving "an upper bound of **1024** tokens
per image". A phone photo of a receipt will hit that ceiling; nothing larger costs more. This
makes DeepSeek the most predictable vision input cost of any provider here.

Also relevant: `detail: "low"` downscales to 512×512. Formats JPEG/PNG/GIF/WebP, detected from
content not filename.

**Function calling:** ✓. Also a `strict` mode (beta) that enforces the function's JSON Schema —
requires `base_url="https://api.deepseek.com/beta"` and `strict: true` per function.

**JSON/structured output:** ✓ but weak. `response_format: {"type":"json_object"}` only — **no
JSON Schema enforcement**. And a documented failure mode: *"if the model's output cannot be
recognized as JSON, the API replaces the non-JSON content with spaces (`U+0020`). As a result,
the returned `content` may contain only spaces (appearing empty, even when `finish_reason` is
`stop`)."* Budget a retry path.

**Bonus: a dedicated OCR API at $0.225 per 1,000 pages** (`POST /v1/tools/ocr`), returning
per-page text with `<|ref|>`/`<|box|>` coordinates. This is the cheapest dedicated OCR found
anywhere (see §7).

Sources: <https://api-docs.deepseek.com/quick_start/pricing>,
<https://api-docs.deepseek.com/guides/vision/>,
<https://api-docs.deepseek.com/guides/tool_calls/>,
<https://api-docs.deepseek.com/guides/json_mode/>,
<https://api-docs.deepseek.com/guides/ocr/>,
<https://api-docs.deepseek.com/updates>

---

## 2. Google Gemini

**Cheapest vision-capable Flash-Lite: `gemini-3.1-flash-lite` at $0.25 in / $1.50 out.**
Inputs: "Text, Image, Video, Audio, and PDF". Function calling ✓, structured outputs ✓.

| Model | Input | Output | Free tier | Notes |
|---|---|---|---|---|
| `gemini-3.1-flash-lite` | **$0.25** (text/image/video) | **$1.50** | "Free of charge" | cheapest vision |
| `gemini-3.5-flash-lite` | $0.30 | $2.50 | "Free of charge" | positioned for "document parsing" |
| `gemini-3.6-flash` | $0.75 → $1.50 on 2027-01-01 | $3.75 → $7.50 | "Free of charge" | |
| `gemini-3.8-flash` | $0.75 → $1.50 on 2027-01-01 | $3.75 → $7.50 | "Free of charge" | promo rate expires 2026-12-31 |
| `gemini-4-carbon` | $2.00 → $4.00 on 2026-12-01 | $10 → $20 | **Not available** | |

**Image input is billed as ordinary input tokens; there is no separate image tariff** (OpenRouter
shows the same 0.25 as an `image` price for consistency). Tokenization rule, official:

> "Images ≤384 pixels in both dimensions count as 258 tokens. Larger images are tiled into
> 768×768 pixel tiles, each counting as 258 tokens."

So a 1000×1500 receipt = 2×2 tiles = **1,032 tokens**; a 3000×4000 photo = 5×6 tiles = **6,192
tokens** — i.e. Gemini is the one provider where a careless full-resolution upload actually costs
money. Downscale receipts client-side.

**Free tier: the per-model RPM/TPM/RPD table is no longer published as static text.** The rate-limits
page now says only that limits "depend on a variety of factors (such as your usage tier) and can be
viewed in Google AI Studio", and the only static tables left are for Omni Flash, Genie 4 and
Decision 1. **I cannot give you a quoted free-tier RPD figure for Flash-Lite from the docs** — you
must read it from `aistudio.google.com/rate-limit`. What *is* stated: Free tier = "Active project
or free trial", and free-tier traffic is "[Yes] used to improve our products" — which for receipt
photos (merchant names, card last-4) is a real decision input, not a footnote.

Sources: <https://ai.google.dev/gemini-api/docs/pricing> (renders as
<https://aistudio.google.com/docs/pricing>),
<https://ai.google.dev/gemini-api/docs/rate-limits>,
<https://ai.google.dev/gemini-api/docs/tokens>,
<https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite>

---

## 3. OpenAI

**The cheap vision models you were going to name are all deprecated.** Per the deprecations page:

- `gpt-4o-mini` — Deprecated, replacement `gpt-6-luna`, retires 2027-01-14
- `gpt-4.1-mini` — Deprecated, replacement `gpt-6-luna`, retires 2027-01-20
- `gpt-5-mini` / `gpt-5-nano` — Deprecated, replacement `gpt-6.1-terra` / `gpt-6-luna`

**Current cheapest vision model: `gpt-6-luna` at $0.10 in / $0.50 out** (cached input $0.01).
Its model page states Input: "Text, Image", Function calling "Supported", Structured outputs
"Supported", 1.05M context, 128K max output. Note Chat Completions only supports function calling
"with `reasoning_effort` set to `none`" — use the Responses API otherwise.

`gpt-6.1-terra` is $1.00 / $5.00. `gpt-6.2-sol` is $2.00 / $10.00.

OpenAI's docs state plainly: *"All latest OpenAI models support text and image input, text output,
multilingual capabilities, and vision."* Image cost uses 32×32 patch tokenization with per-model
patch budgets, or `detail: "low"` for a flat cheap path.

Sources: <https://openai.com/api/pricing> (→ <https://developers.openai.com/api/docs/pricing>),
<https://developers.openai.com/api/docs/models/gpt-6-luna>,
<https://developers.openai.com/api/docs/deprecations>

---

## 4. Anthropic

**Current Haiku: `claude-haiku-5-5`** (released 2026-10-07).

| | ≤100K-token prompt | >100K-token prompt |
|---|---|---|
| Input | **$0.10** | $0.50 |
| Output | **$0.50** | $2.50 |
| Cache read | $0.01 | $0.05 |

- **Vision:** ✓ — "Input → output: Text and images → text".
- **Tool use:** ✓, plus *strict tool use* (`strict: true`) for schema-guaranteed tool inputs.
- **Structured output:** ✓ — `output_config.format` with `type: "json_schema"`, constrained
  decoding, "Always valid: no JSON parsing errors".
- **Price caveat:** "Claude 4.7 and later models … use a newer tokenizer … approximately **30%
  more tokens for the same text**." Haiku 5.5 uses that tokenizer, so $0.10/$0.50 here buys
  ~23% less text than the same number bought on Haiku 4.5 ($1/$5). Net still far cheaper.
- Adaptive thinking is **on by default** at `effort: medium`, and thinking tokens are billed as
  output. For a formatting-constrained DSL emit, set effort low or you pay for deliberation on
  every turn.

Source: <https://platform.claude.com/docs/en/about-claude/pricing>,
<https://platform.claude.com/docs/en/models/haiku-5-5/overview>,
<https://platform.claude.com/docs/en/build-with-claude/structured-outputs>

---

## 5. Qwen / Alibaba

**Best cheap option: `qwen3.8-flash`.** Model card: Input Modality "Image / Text / Video",
Function Calling "Supported", Structured Outputs "Supported", context 1,000,000.

Official Model Studio pricing (per region, "Price (USD)"):

| Region | Input | Output | Implicit cache |
|---|---|---|---|
| Singapore (International) | **$0.15** | **$0.47** | $0.016 |
| US (Virginia), Global scope | $0.113 | $0.382 | $0.014 |
| China (Beijing) | $0.113 | $0.382 | $0.014 |

Via OpenRouter the sibling `qwen/qwen3.7-flash` is **$0.03 / $0.13** — an order of magnitude
cheaper again, vision-capable (text/image/video), 1M context.

**Receipt/document quality:** in OpenRouter's OCR benchmark (8 degraded scans, 264 key-value
checks), `qwen/qwen3.8-flash` scored **248/264 key values, 0.74% CER, $0.29 per 1,000 pages**;
`qwen/qwen3.8-27b` scored 246/264 at $1.54. Respectable, mid-table.

**But Qwen is the weakest model tested on OpenUI Lang adherence** — see §8. That combination
(good OCR, weakest DSL) rules it out as a single model for both jobs.

Sources: <https://www.alibabacloud.com/help/en/model-studio/qwen3-8-flash>,
<https://www.alibabacloud.com/help/en/model-studio/models>,
<https://openrouter.ai/qwen>

---

## 6. Aggregators / cheap hosted vision models

From OpenRouter's live model list (`/api/v1/models`, filtered to `image` input, sorted by price):

| Model | $/M in | $/M out |
|---|---|---|
| `qwen/qwen3.7-flash` | 0.03 | 0.13 |
| `deepseek/deepseek-v4.1-flash-1017` | 0.03 | 0.20 |
| `openai/gpt-5-nano` (deprecated upstream) | 0.05 | 0.40 |
| `inclusionai/ling-3.0-flash-vl` | **0.06** | **0.18** |
| `openai/gpt-6-luna` | 0.10 | 0.50 |
| `anthropic/claude-haiku-5.5` | 0.10 | 0.50 |
| `qwen/qwen3.8-flash` | 0.15 | 0.47 |
| `google/gemini-3.1-flash-lite` | 0.25 | 1.50 |
| `meta-llama/llama-4-maverick` | 0.35 | 1.00 |

Notes on the specific models you asked about:

- **Llama 4 vision is no longer cheap.** Maverick is $0.35/$1.00 — worse than everything above.
- **MiniCPM-V is not on OpenRouter** any more (no listing under `openbmb/`). Open weights only;
  self-host or nothing.
- **Mistral OCR** is available as a *file-parser plugin engine* on OpenRouter at **$2 per 1,000
  pages**, not as a chat model. Direct API is the same: Standalone "OCR 3 $2/1000 Pages",
  "OCR 4.1 $4/1000 Pages".
- **Zero-cost options exist but are traps:** `google/gemma-4-26b-a4b-it:free`,
  `nvidia/nemotron-3.5-super-vl:free`, `inclusionai/ling-3.2-flash:free`. Free endpoints are
  rate-limited and are the first thing to disappear; do not build a product on them.
- **Cheapest credible document extractor: `ling-3.0-flash-vl` at $0.06/$0.18**, which scored
  **254/264 key values at $0.04 per 1,000 pages** in OpenRouter's own OCR benchmark — second-best
  accuracy-per-dollar of anything measured, and third-best accuracy outright (behind Opus 5.5 and
  Mistral OCR). Requires `reasoning: {"effort": "none"}` to reach that price.

Source: <https://openrouter.ai/models?modality=text%2Bimage-%3Etext&order=price>,
<https://openrouter.ai/blog/insights/best-ocr-model/>,
<https://docs.mistral.ai/inference/pricing>

---

## 7. Receipt OCR specifically — dedicated engine vs general VLM

Per-page list prices, official:

| Engine | Price / 1,000 pages | Per receipt (1 page) | 200 receipts/mo |
|---|---|---|---|
| **DeepSeek OCR API** | **$0.225** | $0.000225 | **$0.04** |
| Mistral OCR 3 | $2.00 | $0.00200 | $0.40 |
| Mistral OCR 4.1 | $4.00 | $0.00400 | $0.80 |
| AWS Textract `AnalyzeExpense` | $10.00 | $0.01000 | $2.00 |
| Google Document AI **Expense parser** | $100.00 | $0.10000 | **$20.00** |

(AWS price read from the `textract.json` price sheet: `AnalyzeExpense … Expense First 1M = 0.0100`
per 1,000 pages, US East and US West. Document AI: "Invoice parser $0.10 / 1 count",
"Expense parser (formerly receipt parser) $0.10 / 1 count".)

**Is a dedicated OCR model cheaper and more accurate? No — the opposite, for your workload.**

Accuracy, from OpenRouter's measured benchmark on degraded receipt scans (264 key-value checks,
8 pages, 3 runs each):

- `mistral-ocr` 258/264, 0.14% CER — $2.02/1k pages. **256/264 on the faded receipt: perfect.**
- `claude-opus-5.5` 262/264 — $16.42/1k pages. Best in class, 70× Mistral's price.
- `google/gemini-3.8-flash` 254/264 — $7.50/1k pages.
- `inclusionai/ling-3.0-flash-vl` 254/264 — **$0.04/1k pages** (reasoning off).
- `deepseek/deepseek-v4.1-flash` 248/264, **0.20% CER** — **$0.16–0.20/1k pages**.
- `anthropic/claude-haiku-5.5` 253/264 — $0.46/1k pages.
- `openai/gpt-6-luna` **232/264 — worst vision model tested** — $0.22–0.54/1k pages.
- Tesseract 5.5 (local, free): perfect on clean print, **returned nothing for the faded receipt**.

Two findings that should shape the design:

1. **A general VLM at DeepSeek's price ($0.0003/receipt) is already ~7× cheaper than Mistral OCR
   and ~30× cheaper than Textract**, at 248/264 rather than 258/264. Document AI's
   expense parser is ~330× the price of a DeepSeek vision call. For one-page receipts the
   dedicated engines are a bad buy unless accuracy is the only axis.
2. **The real failure mode is not character error, it's plausible fabrication.** Quoting the
   benchmark: on a faded receipt, "*GPT-6 Luna and GPT-6.1 Sol made up card digits, wifi passwords
   and a server name.*" GPT-6 Luna produced `CARD **** 9027` where the page said `9026`, invented
   a server name, and got the wifi password wrong in **all three runs**. Instructing models to
   emit `[?]` instead of guessing did not help: "four of seven models never used the marker."
   Mistral OCR got every value on that receipt right.

So: a general VLM reading a **clean, well-lit phone photo** is accurate and dramatically cheaper.
A general VLM reading a **faded thermal receipt** will confidently invent a total. Dedicated OCR
buys you the absence of invention, not better character recognition.

Open-source: PaddleOCR (repo live) and dots.ocr both work and cost $0 marginal, but you host,
deploy and maintain them — for 200 pages/month that engineering time exceeds a decade of API
spend. Not worth it unless you are already running GPU infra.

---

## 8. DSL adherence by model — the actual risk

### What OpenUI publishes

`openui.com/docs/openui-lang/benchmarks` is a **token-efficiency** benchmark (OpenUI Lang vs YAML
vs Vercel JSON-Render vs Thesys C1 JSON, generated by GPT-5.2 at temperature 0, one format derived
from the other rather than independently generated). It is **not** a per-model reliability study.
Its numbers you can use: OpenUI Lang is 47.4% fewer tokens than YAML, 52.8% fewer than JSON-Render,
51.7% fewer than C1; 4,800 tokens vs 9,122 across 7 scenarios.

`openui.com/docs/openui-lang/reliability` points to the real study:
**`openui.com/blog/generative-ui-benchmark`** (Thesys Engineering, 2026-08-17). 6 models × 46 briefs
× 4 runs = 1,104 runs per format, 70-component catalog.

Structural validity, OpenUI Lang, per model:

| Model | OpenUI | A2UI | json-render |
|---|---|---|---|
| Sol (OpenAI) | **99.5** | 96.2 | 82.6 |
| Claude Opus 4.8 | 98.9 | 99.5 | 87.5 |
| Gemini 3.7 Flash | **98.9** | 94.0 | 92.9 |
| Kimi K3 | 96.2 | 95.7 | 71.2 |
| Muse Spark 1.2 (Meta) | 96.2 | 96.7 | 81.5 |
| **Qwen3.8 2.4T** | **91.8** | 91.3 | 81.0 |
| Average | 96.9 | 95.6 | 82.8 |

Blank screens with OpenUI Lang: **1 in 1,104** (0.09%), vs A2UI 37 (3.35%) and json-render 4.

**The finding that matters most for a cheap-model choice:** the format is *not* where reliability
lives. OpenUI's own summary — "Reliability came out roughly format-agnostic; where the formats
actually separate is cost and failure shape" — and, critically, **"a compact, line-based DSL, a
format these models have seen far less of, matched them on structural validity."** Modern models
are post-trained on JSON and tool calls, yet a novel line-oriented DSL tied them. Familiarity with
the format is not the bottleneck.

Failure shape, from ~7% of production OpenUI-Lang generations tripping validation on first pass:

| Failure family | Share |
|---|---|
| No valid root (often truncation-related) | 44% |
| Reference graph (dangling/orphaned refs) | 36% |
| Enum, type and argument errors | 16% |
| Truncation | 4% |

84% of failures are **structural/truncation**, not comprehension. Two consequences: (a) set
`max_tokens` generously and disable thinking for formatting turns, or you manufacture the top two
failure families yourself; (b) the failure is *local* — "a broken OpenUI line costs you that line;
a broken JSON document costs you the screen" — so a retry or a sanitizer pass recovers ~9 in 10.

Also worth knowing: OpenUI ships [Gateway](https://openui.com/docs/gateway) and an
[Autofix API](https://openui.com/docs/autofix) that fix output during/after streaming
("fixed 96% of generations that initially failed validation"); a valid generation is free, each
fix is a flat charge.

### The blunt answer to "do small models degrade on novel DSLs?"

**Nobody has published the data.** Every model in OpenUI's benchmark is a frontier or near-frontier
model — the cheapest tested is Gemini 3.7 Flash at $0.75/$3.75, which is 3–7× the price of the
Flash-Lite/Luna tier. No Flash-Lite, no `-mini`/`-nano`, no open-weight small model was tested.
Extrapolating Sol's 99.5% down to gpt-6-luna, or Gemini 3.7 Flash's 98.9% down to 3.1 Flash-Lite,
is **unmeasured inference** — and the benchmark's own warning cuts against it: "prompt content moves
these numbers about as much as format choice does… One rule… was worth 13 points… a single wrong
worked example cost two models double digits."

What *is* measured, and adverse to Qwen: **Qwen3.8 2.4T is the weakest model on OpenUI Lang at
91.8%**, and "produced the most empty responses of any model" — empty responses are unrecoverable
blank screens, not repair-worthy line errors. If Qwen were otherwise your pick (it is cheap and
decent at OCR), this specifically disqualifies it for the DSL half.

Community/practitioner signal is thin and mostly anecdotal for this exact question; I would not
cite it. The only defensible position is: **cheap-tier DSL adherence is unknown, so measure it —
first 100 generations, your component library, your prompts, pass/fail.** OpenUI itself says
"Evaluate model selection. Test models using your own component library and representative
prompts."

Note the project's own ADR-0006 already accepts "roughly 7% of first-pass generations fail
validation" plus a single retry. That is the frontier baseline. A cheap model needs to land near
it, not at 80%.

---

## 9. Cost arithmetic

Two parameter sets. **(A)** is the task's stated assumption. **(B)** uses OpenUI's own measured
numbers — 5,031-token system prompt for their 70-component catalog, 1,362 mean output tokens per
screen — scaled to a personal-expense catalog (≈6 components) at **3,000 input / 1,362 output**
per chat turn, which is the honest figure for a generated UI, not a 300-token chat reply.

### Per unit

| Model | in/out $/M | 1 receipt (1,200 in + 200 out) | 1 chat A (2,000/300) | 1 chat B (3,000/1,362) |
|---|---|---|---|---|
| DeepSeek `deepseek-flash` off-peak | 0.15 / 0.60 | $0.000300 | $0.000480 | $0.001267 |
| OpenAI `gpt-6-luna` | 0.10 / 0.50 | $0.000220 | $0.000350 | $0.000981 |
| Claude Haiku 5.5 | 0.10 / 0.50 | $0.000220 | $0.000350 | $0.000981 |
| Ling 3.0 Flash VL | 0.06 / 0.18 | $0.000108 | $0.000174 | $0.000425 |
| Qwen3.8-Flash intl | 0.15 / 0.47 | $0.000274 | $0.000441 | $0.001090 |
| Gemini 3.1 Flash-Lite | 0.25 / 1.50 | $0.000600 | $0.000950 | $0.002793 |

### Monthly totals

Assumption A = 1,200 + 200 per receipt, 2,000 + 300 per chat:

| Model | 50 rec / 300 chat | 200 rec / 300 chat | 200 rec / 500 chat |
|---|---|---|---|
| Ling 3.0 Flash VL | $0.06 | **$0.07** | $0.11 |
| OpenAI `gpt-6-luna` | $0.12 | $0.15 | $0.22 |
| Claude Haiku 5.5 | $0.12 | $0.15 | $0.22 |
| Qwen3.8-Flash | $0.15 | $0.19 | $0.28 |
| **DeepSeek** off-peak | $0.16 | $0.20 | $0.30 |
| DeepSeek peak | $0.32 | $0.41 | $0.60 |
| Gemini 3.1 Flash-Lite | $0.32 | $0.41 | $0.59 |
| Gemini 3.5 Flash-Lite | $0.45 | $0.58 | $0.85 |
| Gemini 3.8 Flash (promo) | $0.87 | $1.12 | $1.64 |
| Gemini 3.8 Flash (from 2027) | $1.74 | $2.23 | $3.29 |

Show the working for the recommended case (DeepSeek, 200 receipts + 300 turns, off-peak):
vision = 200 × 1,200 ÷ 10⁶ × $0.15 + 200 × 200 ÷ 10⁶ × $0.60 = $0.036 + $0.024 = **$0.060**;
chat = 300 × 2,000 ÷ 10⁶ × $0.15 + 300 × 300 ÷ 10⁶ × $0.60 = $0.090 + $0.054 = **$0.144**;
total **$0.204**.

Assumption B = 1,200 + 200 per receipt, 3,000 + 1,362 per chat (more realistic):

| Model | 200 rec / 300 chat | 200 rec / 500 chat |
|---|---|---|
| Ling 3.0 Flash VL | $0.15 | $0.23 |
| OpenAI `gpt-6-luna` | $0.34 | $0.53 |
| Claude Haiku 5.5 | $0.34 | $0.53 |
| Qwen3.8-Flash | $0.38 | $0.60 |
| **DeepSeek** off-peak | $0.44 | $0.69 |
| DeepSeek peak | $0.88 | $1.39 |
| Gemini 3.1 Flash-Lite | $0.96 | $1.52 |
| Gemini 3.5 Flash-Lite | $1.46 | $2.32 |
| Gemini 3.8 Flash (promo) | $2.54 | $4.01 |

**Conclusion: the answer is under $1/month for every candidate at the high end of your volume, and
under $0.25/month for most.** At this scale you should optimise for correctness and for not
spending your weekends debugging, not for $0.30.

The one cost lever that actually matters is **prompt caching of the OpenUI system prompt**. A
5,000-token system prompt re-sent 300 times is 1.5M input tokens/month. At DeepSeek off-peak
cache-hit ($0.003/M vs $0.15/M) that is $0.005 instead of $0.225; on Anthropic Haiku 5.5 cache
read is $0.01/M vs $0.10/M. Cache the system prompt, and the input side of chat nearly vanishes.

---

## Recommendation

**Primary: DeepSeek `deepseek-flash`.** $0.15/$0.60 off-peak, native API vision with a hard
1,024-token image cap, function calling with a `strict` JSON-Schema mode, and a $0.225/1,000-page
OCR endpoint as a fallback for receipts it reads badly. Roughly $0.20–0.44/month at your volume.

**Runner-up, and where I would put the DSL half if DeepSeek disappoints on format: Gemini
`gemini-3.1-flash-lite`.** $0.25/$1.50, vision, function calling, JSON-Schema structured output,
and a free tier that may cover 200 receipts + 300 turns outright — but that free tier trains on
your data, so pay for Tier 1 if receipts contain anything you care about.

**Why not a dedicated OCR engine:** at one page per receipt, Mistral OCR is ~7× and Document AI
~330× the cost of a general VLM call, and only buys you resistance to fabrication on faded thermal
paper. Your architecture already absorbs that risk: ADR-0002 makes the extraction a *draft*,
ADR-0007 makes confirmation a human button press. A hallucinated total is displayed and rejected,
not recorded. So skip the OCR tier initially; add Mistral OCR ($2/1,000 pages) only if your own
receipts show fabricated totals.

**Why not Qwen as the single model:** good OCR (248/264) but the weakest measured OpenUI Lang
adherence (91.8%) with the most empty responses of any model tested. Wrong shape of failure.

**Two caveats I would not paper over:**

1. **Nobody has measured OpenUI Lang adherence for any model in this price tier.** The benchmark
   covers frontier models only; its cheapest entry, Gemini 3.7 Flash, costs 3–7× what Flash-Lite
   and Luna cost. Any claim that a $0.10/M model emits your DSL at 98% is unverified.
2. **Build the eval before you build the integration.** 100 generations, your component library,
   your prompt, `max_tokens` set generously and thinking disabled per formatting turn — because
   48% of production failures are missing-root/truncation, which is a *configuration* failure you
   can fix for free on any model.

Sources: <https://api-docs.deepseek.com/quick_start/pricing>,
<https://ai.google.dev/gemini-api/docs/pricing>,
<https://openai.com/api/pricing>,
<https://platform.claude.com/docs/en/about-claude/pricing>,
<https://openui.com/blog/generative-ui-benchmark>,
<https://openui.com/docs/openui-lang/benchmarks>,
<https://openrouter.ai/blog/insights/best-ocr-model/>,
<https://docs.mistral.ai/inference/pricing>,
<https://aws.amazon.com/textract/pricing/>,
<https://cloud.google.com/document-ai/pricing>
