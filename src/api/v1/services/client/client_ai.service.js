import { enqueuePropertyAi } from "#services/properties/property_ai_queue.service.js"

// Only the error name: provider errors carry the full request, which holds the listing text.
const logEnqueueFailure = error =>
    console.error("[AI_PROPERTY_POSTPROCESS] enqueue failed", typeof error?.name === "string" ? error.name : "UnknownError")

/**
 * Starts the private-listing AI step after the response was sent (design D §5). Only identifiers go to the property
 * AI queue and the worker does the work; the listing text is read from the database there, so it never reaches Redis
 * or the logs. When queueing fails the error is logged and the row stays PENDING for the sweep.
 *
 * @param {{ propertyId: string, baselineUpdatedAt: Date | number, userId?: string | null, orderPhotos?: boolean }} args
 * @param {{ defer?: Function, enqueue?: Function }} [deps]
 */
export const scheduleAiPostprocess = (args, { defer = setImmediate, enqueue = enqueuePropertyAi } = {}) => {
    const { propertyId, baselineUpdatedAt, userId, orderPhotos } = args
    defer(() => {
        try {
            const request = {
                propertyId,
                baselineUpdatedAt: baselineUpdatedAt instanceof Date ? baselineUpdatedAt.getTime() : baselineUpdatedAt,
                orderPhotos: orderPhotos === true,
            }
            if (userId !== undefined && userId !== null) request.userId = userId
            Promise.resolve(enqueue(request)).catch(logEnqueueFailure)
        } catch (error) {
            logEnqueueFailure(error)
        }
    })
}
