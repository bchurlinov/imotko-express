// COPIED FROM imotko/src/lib/ai/posthog_observability.js by scripts/export_property_rules.mjs — do not edit here.
// Change the web file, then re-run the script (design D §3).
import { randomUUID } from "node:crypto"
import { withTracing } from "@posthog/ai"
import { flushInBackground, getPosthogServerClient } from "#shared/ai/posthog_server.js"

export const observeLanguageModel = (model, { sessionId, distinctId, traceName } = {}) => {
    const posthog = getPosthogServerClient()
    if (!posthog) return model

    return withTracing(model, posthog, {
        posthogProperties: sessionId ? { $ai_session_id: sessionId } : {},
        posthogTraceId: randomUUID(),
        // Prompts can hold unpublished drafts and owner phone numbers/emails: keep metrics, drop the text.
        posthogPrivacyMode: true,
        ...(distinctId ? { posthogDistinctId: distinctId } : {}),
        ...(traceName ? { traceName } : {}),
    })
}

// Never awaited: the flush runs after the response via waitUntil.
export const flushAiObservability = () => flushInBackground()
