/**
 * The OpenUI Lang eval: N generations against the real component library,
 * through the same provider Layer the Worker uses, graded by the same
 * validator. Writes the results into docs/research/openui-eval.md.
 *
 *   API_PROVIDER_KEY=sk-... node apps/api/scripts/eval-openui.ts
 *   node apps/api/scripts/eval-openui.ts --fake        # dry run: no network, no key, no file written
 *
 * Options: --generations 100, --concurrency 4, --provider deepseek|gemini
 * (default $MODEL_PROVIDER or deepseek), --model <name> (default $MODEL_NAME or
 * the provider's), --out <file> (default the research doc; a dry run writes
 * only when given one).
 */
import { readFile, writeFile } from "node:fs/promises"
import { parseArgs } from "node:util"
import { Effect } from "effect"
import {
  defaultModelProvider,
  ModelProviderLive,
  modelProviders,
} from "../src/features/chat/ModelProvider.ts"
import { fakeEvalModel, formatReport, plainSecret, runEval } from "./openui/OpenUiEval.ts"

const { values } = parseArgs({
  options: {
    fake: { type: "boolean", default: false },
    generations: { type: "string", default: "100" },
    concurrency: { type: "string", default: "4" },
    provider: { type: "string" },
    model: { type: "string" },
    out: { type: "string" },
  },
})

const docPath = new URL("../../../docs/research/openui-eval.md", import.meta.url)
const start = "<!-- openui-eval:results:start -->"
const end = "<!-- openui-eval:results:end -->"

const providerName = values.provider ?? process.env["MODEL_PROVIDER"] ?? defaultModelProvider
const provider = (modelProviders as Record<string, { readonly model: string } | undefined>)[
  providerName
]
const modelName = values.model ?? process.env["MODEL_NAME"] ?? provider?.model ?? "unknown"

const languageModel = (() => {
  if (values.fake) return fakeEvalModel
  const key = process.env["API_PROVIDER_KEY"]
  if (key === undefined || key === "") {
    console.error("API_PROVIDER_KEY is not set. Pass --fake for a dry run.")
    process.exit(1)
  }
  return ModelProviderLive({ provider: providerName, model: modelName, apiKey: plainSecret(key) })
})()

const generations = Number(values.generations)
const report = await runEval({
  generations,
  // The fake answers in call order; one at a time keeps a dry run reproducible.
  concurrency: values.fake ? 1 : Number(values.concurrency),
  onResult: (result, done) =>
    Effect.sync(() => console.error(`[${done}/${generations}] ${result.case}: ${result.outcome}`)),
}).pipe(Effect.provide(languageModel), Effect.runPromise)

const markdown = formatReport({
  ...report,
  model: values.fake ? "fake (dry run)" : `${providerName}/${modelName}`,
  ranAt: new Date().toISOString(),
})
console.log(markdown)

const out = values.out ?? (values.fake ? undefined : docPath.pathname)
if (out !== undefined) {
  const existing = await readFile(out, "utf8").catch(() => "")
  const block = `${start}\n${markdown}\n${end}`
  const from = existing.indexOf(start)
  const to = existing.indexOf(end)
  const updated =
    from !== -1 && to > from
      ? existing.slice(0, from) + block + existing.slice(to + end.length)
      : `${existing}${existing === "" ? "" : "\n\n"}${block}\n`
  await writeFile(out, updated)
  console.error(`Wrote ${out}`)
}
