import { SWEEP_JOB_NAME } from "./sweep.js"

/**
 * Post-processes one saved property: AI text, optional photo order, one guarded write, then the cache and
 * Facebook follow-ups. Every collaborator is injected so the order of side effects can be tested without
 * Redis, the database or an LLM.
 *
 * The job carries identifiers only; the property is loaded here, so listing text never reaches Redis. Logs hold
 * ids, the job id, the attempt number and error names, never messages or request bodies (an AI SDK error carries
 * the full request). A failed job is logged once by the worker's failed event.
 *
 * @param {object} deps
 * @param {(propertyId: string) => Promise<object | null>} deps.loadProperty
 * @param {(property: object, aiContext: object) => Promise<object>} deps.enrichStored - Text patch, throws on failure
 * @param {(property: object, options: object) => Promise<object[] | null>} deps.orderPhotos - null leaves photos alone
 * @param {(propertyId: string, baselineUpdatedAt: Date, data: object) => Promise<boolean>} deps.writeIfUnchanged
 * @param {(property: object) => object} deps.toFailurePatch
 * @param {(options: { propertyId: string, previousSlug?: string }) => Promise<void>} deps.revalidate
 * @param {(payload: { agencyId: string, propertyId: string }) => Promise<void>} deps.notifyTemplates
 * @param {(payload: { propertyId: string, agencyId: string, revision: number }) => Promise<unknown>} deps.enqueueFacebook
 * @param {() => Promise<unknown>} [deps.sweep] - Runs the repeatable stuck-listing sweep (a job named "sweep")
 * @param {{ info: Function, error: Function }} deps.logger
 * @returns {(job: import('bullmq').Job) => Promise<void>}
 */
export function createPropertyAiProcessor({
    loadProperty,
    enrichStored,
    orderPhotos,
    writeIfUnchanged,
    toFailurePatch,
    revalidate,
    notifyTemplates,
    enqueueFacebook,
    sweep,
    logger,
}) {
    const log = (level, event, fields) => {
        try {
            logger?.[level]?.(event, fields)
        } catch {
            // Logging must never turn finished work into a retry.
        }
    }

    // Retries are over: record the failure, refresh the caches it changed (a private listing's text is stripped and
    // flagged FAILED), then still queue Facebook. No step may hide the text error the caller is about to rethrow.
    const settleFailure = async ({ property, baseline, queueFacebook }) => {
        const fields = { propertyId: property.id }
        try {
            if (await writeIfUnchanged(property.id, baseline, toFailurePatch(property))) {
                await revalidate({ propertyId: property.id })
                await notifyTemplates({ agencyId: property.agencyId, propertyId: property.id })
            }
        } catch (error) {
            log("error", "property_ai_failure_write_failed", { ...fields, errorCode: error?.name || "unknown" })
        }
        try {
            await queueFacebook()
        } catch (error) {
            log("error", "property_ai_facebook_enqueue_failed", { ...fields, errorCode: error?.name || "unknown" })
        }
    }

    return async job => {
        // The repeatable sweep job carries no property: it must never reach the processing steps below
        if (job.name === SWEEP_JOB_NAME) {
            await sweep?.()
            return
        }

        const { propertyId, baselineUpdatedAt, orderPhotos: shouldOrderPhotos, userId, facebookRevision } = job.data
        const attempt = job.attemptsMade + 1
        const isLastAttempt = attempt >= job.opts.attempts
        const jobFields = { jobId: job.id, jobName: job.name, propertyId, attempt }

        log("info", "property_ai_job_started", jobFields)

        const property = await loadProperty(propertyId)
        if (!property || property.status === "DELETED") {
            log("info", "property_ai_job_skipped", { ...jobFields, reason: property ? "deleted" : "missing" })
            return
        }

        // Approval chained a Facebook post to this job; it is queued whether or not the AI step ran or won its write
        const queueFacebook = async () => {
            if (facebookRevision === undefined) return
            await enqueueFacebook({ propertyId, agencyId: property.agencyId, revision: facebookRevision })
        }

        // A newer save or an earlier attempt of this job already wrote the row: no second LLM call, and a Facebook
        // enqueue that failed after the write is retried from here.
        if (property.updatedAt.getTime() !== baselineUpdatedAt) {
            log("info", "property_ai_job_skipped", { ...jobFields, reason: "stale" })
            await queueFacebook()
            return
        }

        const baseline = new Date(baselineUpdatedAt)
        const aiContext = { sessionId: `property-${propertyId}`, distinctId: userId ?? "system" }

        let patch
        let photos
        try {
            ;[patch, photos] = await Promise.all([
                enrichStored(property, aiContext),
                orderPhotos(property, { orderPhotos: shouldOrderPhotos, aiContext }),
            ])
        } catch (error) {
            // Not logged here: enrichStored logs the sanitized name and status, and the worker logs the failed job
            if (isLastAttempt) await settleFailure({ property, baseline, queueFacebook })
            throw error
        }

        if (Array.isArray(photos)) patch = { ...patch, photos }

        if (await writeIfUnchanged(propertyId, baseline, patch)) {
            await revalidate({ propertyId, previousSlug: property.slug !== patch.slug ? property.slug : undefined })
            await notifyTemplates({ agencyId: property.agencyId, propertyId })
        } else {
            log("info", "property_ai_job_skipped", { ...jobFields, reason: "guard-lost" })
        }

        await queueFacebook()
    }
}
