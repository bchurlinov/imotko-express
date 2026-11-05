import { Queue } from "bullmq"
import IORedis from "ioredis"
import { PROPERTY_AI_QUEUE_NAME } from "../../../../../workers/property-ai-postprocess/queue_name.js"

/**
 * Producer side of the property AI post-processing queue.
 *
 * imotko (Next, on Vercel) calls POST /api/v1/internal/property-ai-postprocess after a property is saved, so Redis
 * only has to be reachable from this server and the worker. The job payload is identifiers only: the worker loads
 * the property itself, so listing text never reaches Redis or the logs.
 *
 * @module services/properties/property_ai_queue
 */

const JOB_NAME = PROPERTY_AI_QUEUE_NAME

// imotko gives up after 5s; answering 503 before that lets its single retry run instead of timing out twice
export const ENQUEUE_TIMEOUT_MS = 4000

export const PROPERTY_AI_JOB_OPTIONS = Object.freeze({
    attempts: 5,
    backoff: Object.freeze({ type: "exponential", delay: 120000 }),
    removeOnComplete: 1000,
    removeOnFail: 5000,
})

const nonEmptyString = value => (typeof value === "string" && value.trim() ? value.trim() : null)

/**
 * Validates the body sent by imotko and keeps only the known identifier fields.
 *
 * @param {unknown} body - Parsed JSON request body
 * @returns {{ propertyId: string, baselineUpdatedAt: number, orderPhotos: boolean, userId?: string,
 *   facebookRevision?: number } | null} Request, or null when invalid
 */
export const parsePropertyAiRequest = body => {
    const propertyId = nonEmptyString(body?.propertyId)
    const baselineUpdatedAt = body?.baselineUpdatedAt
    const orderPhotos = body?.orderPhotos
    const facebookRevision = body?.facebookRevision

    if (!propertyId) return null
    if (!Number.isSafeInteger(baselineUpdatedAt) || baselineUpdatedAt <= 0) return null
    if (typeof orderPhotos !== "boolean") return null
    if (facebookRevision !== undefined && (!Number.isSafeInteger(facebookRevision) || facebookRevision <= 0)) {
        return null
    }

    const request = { propertyId, baselineUpdatedAt, orderPhotos }
    const userId = nonEmptyString(body?.userId)
    if (userId) request.userId = userId
    if (facebookRevision !== undefined) request.facebookRevision = facebookRevision
    return request
}

/**
 * One job per property save: a retried request or a double call for the same baseline is a no-op in BullMQ.
 *
 * @param {{ propertyId: string, baselineUpdatedAt: number }} request
 * @returns {string} BullMQ job id
 */
export const getPropertyAiJobId = ({ propertyId, baselineUpdatedAt }) => `property-ai-${propertyId}-${baselineUpdatedAt}`

// AggregateError (e.g. ECONNREFUSED on both ::1 and 127.0.0.1) has an empty message, so log the code instead
const describeRedisError = error => error?.code || error?.message || String(error)

/** @type {Queue | undefined} */
let queue
/** @type {IORedis | undefined} */
let queueConnection

/**
 * Lazily opens the queue and its Redis connection.
 * @returns {Queue}
 */
export const getPropertyAiQueue = () => {
    if (queue) return queue

    const url = process.env.UPSTASH_REDIS_URL?.trim()
    if (!url) throw new Error("UPSTASH_REDIS_URL is required to enqueue property AI jobs")

    queueConnection = new IORedis(url, {
        // Request path: fail the call instead of hanging it while Redis is down
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        tls: url.startsWith("rediss://") ? {} : undefined,
    })
    // Without a listener ioredis emits an unhandled 'error' event and crashes the process
    queueConnection.on("error", error => {
        console.error("[propertyAiQueue] redis error:", describeRedisError(error))
    })

    queue = new Queue(PROPERTY_AI_QUEUE_NAME, { connection: queueConnection, defaultJobOptions: PROPERTY_AI_JOB_OPTIONS })
    // The queue re-emits connection errors; already logged above, but an 'error' event needs a listener
    queue.on("error", () => {})
    return queue
}

/**
 * Adds a processing job. The payload stays identifiers-only; the worker loads and re-checks the property.
 *
 * BullMQ waits for the connection to become ready without a deadline, so while Redis is down `add` would hang the
 * request. It is capped here; a job that still lands later is harmless because the job id is per baseline.
 *
 * @param {{ propertyId: string, baselineUpdatedAt: number, orderPhotos: boolean, userId?: string,
 *   facebookRevision?: number }} request
 * @param {{ getQueueImpl?: () => Pick<Queue, "add">, timeoutMs?: number }} [deps]
 * @returns {Promise<import('bullmq').Job>} The added (or already existing) job
 */
export const enqueuePropertyAi = async (
    { propertyId, baselineUpdatedAt, orderPhotos, userId, facebookRevision },
    { getQueueImpl = getPropertyAiQueue, timeoutMs = ENQUEUE_TIMEOUT_MS } = {}
) => {
    const payload = { propertyId, baselineUpdatedAt, orderPhotos }
    if (userId !== undefined) payload.userId = userId
    if (facebookRevision !== undefined) payload.facebookRevision = facebookRevision

    let timer
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Redis did not answer within ${timeoutMs}ms`)), timeoutMs)
    })

    try {
        const adding = getQueueImpl().add(JOB_NAME, payload, {
            jobId: getPropertyAiJobId({ propertyId, baselineUpdatedAt }),
        })
        // A late rejection after the timeout won must not become an unhandled rejection (fatal in app.js)
        adding.catch(() => {})
        return await Promise.race([adding, timeout])
    } finally {
        clearTimeout(timer)
    }
}

/**
 * Closes the queue and its Redis connection, if one was ever opened
 * @returns {Promise<void>}
 */
export const closePropertyAiQueue = async () => {
    if (!queue) return

    const [closingQueue, closingConnection] = [queue, queueConnection]
    queue = undefined
    queueConnection = undefined
    // BullMQ does not close a connection it was given, so it is quit separately
    await closingQueue.close()
    await closingConnection?.quit().catch(() => {})
}
