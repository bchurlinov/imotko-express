// COPIED FROM imotko/src/lib/ai/property_prefill/extract.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { generateText, Output } from "ai"
import { openai } from "@ai-sdk/openai"
import { flushAiObservability, observeLanguageModel } from "../posthog_observability.js"
import { toPlainText } from "./normalize.js"
import { buildPrefillOutputSchema } from "./schema.js"
import { buildPrefillUserPrompt, PREFILL_SYSTEM_PROMPT } from "./prompt.js"
import { verifyPrefill } from "./verify.js"

export const PREFILL_MODEL = "gpt-4o"
export const PREFILL_TIMEOUT_MS = 30_000

export class PrefillTimeoutError extends Error {
    constructor() {
        super("aiPrefillTimeout")
        this.name = "PrefillTimeoutError"
    }
}

// Runs only in imotko-express (copied there by scripts/export_property_rules.mjs); `generate` is injectable for tests.
export const extractPropertyPrefill = async (
    { text, locale = "mk", context = {}, actorKind, signal, distinctId, includeShortTerm = true } = {},
    { generate = generateText, timeoutMs = PREFILL_TIMEOUT_MS } = {}
) => {
    const plainText = toPlainText(text)
    const timeout = AbortSignal.timeout(timeoutMs)
    const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout

    try {
        const { output } = await generate({
            model: observeLanguageModel(openai(PREFILL_MODEL), { distinctId, traceName: "property_prefill" }),
            output: Output.object({ schema: buildPrefillOutputSchema() }),
            system: PREFILL_SYSTEM_PROMPT,
            prompt: buildPrefillUserPrompt({ text: plainText, locale, context, actorKind }),
            temperature: 0,
            abortSignal,
        })
        return verifyPrefill(output, { text: plainText, locale, context, actorKind, includeShortTerm })
    } catch (error) {
        if (timeout.aborted && !signal?.aborted) throw new PrefillTimeoutError()
        throw error
    } finally {
        flushAiObservability()
    }
}
