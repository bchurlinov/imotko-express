import createError from "http-errors"
import { PrefillTimeoutError } from "#shared/ai/property_prefill/extract.js"
import { parsePrefillBody } from "#services/ai/property_prefill_input.js"

// Never logs the pasted text or extracted values (spec §3.1): ids, counts and duration only.
export const createPropertyPrefillController =
    ({ extract }) =>
    async (req, res, next) => {
        const input = parsePrefillBody(req.body)
        if (!input) return next(createError(400, "validationFailed"))

        const controller = new AbortController()
        // A closed connection before the response means the agent cancelled: stop paying for the LLM.
        const onClose = () => {
            if (!res.writableFinished) controller.abort()
        }
        res.on("close", onClose)
        const startedAt = Date.now()

        try {
            const { fields, skipped } = await extract({
                ...input,
                actorKind: req.actor.kind,
                // Older apps cannot render short-term rent; the web dashboard declares itself as "web" (capabilities).
                includeShortTerm: req.capabilities?.shortTermRent === true,
                signal: controller.signal,
                distinctId: req.actor.userId,
            })
            console.info("[ai-prefill] done", {
                actor: req.actor.kind,
                userId: req.actor.userId,
                agencyId: req.actor.agencyId ?? null,
                filled: Object.keys(fields).length,
                skipped,
                ms: Date.now() - startedAt,
            })
            return res.status(200).json({ data: { fields, skipped }, message: "ok" })
        } catch (error) {
            if (controller.signal.aborted) return
            if (error instanceof PrefillTimeoutError) return next(createError(504, "aiPrefillTimeout"))
            console.error("[ai-prefill] failed", {
                userId: req.actor.userId,
                error: error instanceof Error ? error.message : String(error),
            })
            return next(createError(502, "aiPrefillFailed"))
        } finally {
            res.off("close", onClose)
        }
    }
