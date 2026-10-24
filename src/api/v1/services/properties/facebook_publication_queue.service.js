import { Queue } from "bullmq"
import IORedis from "ioredis"
import { FACEBOOK_QUEUE_NAME } from "../../../../../workers/facebook-property-publication/queue_control.js"

/**
 * Producer side of the Facebook property publication queue.
 *
 * imotko (Next, on Vercel) used to add these jobs itself over a Redis TCP connection. It now calls
 * POST /api/v1/internal/facebook-publication instead, so Redis only has to be reachable from this server
 * and the worker, never from Vercel.
 *
 * @module services/properties/facebook_publication_queue
 */

const JOB_NAME = "publish-approved-property"

// Same options imotko used when it enqueued directly, so job retention and retries do not change
const DEFAULT_JOB_OPTIONS = Object.freeze({
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
})

const nonEmptyString = value => (typeof value === "string" && value.trim() ? value.trim() : null)

/**
 * Validates the body sent by imotko.
 *
 * @param {unknown} body - Parsed JSON request body
 * @returns {{ propertyId: string, agencyId: string, revision: number } | null} Request, or null when invalid
 */
export const parseFacebookPublicationRequest = body => {
    const propertyId = nonEmptyString(body?.propertyId)
    const agencyId = nonEmptyString(body?.agencyId)
    const revision = body?.revision
    if (!propertyId || !agencyId || !Number.isSafeInteger(revision) || revision <= 0) return null

    return { propertyId, agencyId, revision }
}

/**
 * One job per property revision: a retried request or a double save of the same revision is a no-op in BullMQ.
 *
 * @param {{ propertyId: string, revision: number }} request
 * @returns {string} BullMQ job id
 */
export const getFacebookPublicationJobId = ({ propertyId, revision }) => `facebook-property-${propertyId}-${revision}`

/** @type {Queue | undefined} */
let queue
/** @type {IORedis | undefined} */
let queueConnection

const getQueue = () => {
    if (queue) return queue

    const url = process.env.UPSTASH_REDIS_URL?.trim()
    if (!url) throw new Error("UPSTASH_REDIS_URL is required to enqueue Facebook publication jobs")

    queueConnection = new IORedis(url, {
        // Request path: fail the call instead of hanging it while Redis is down
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        tls: url.startsWith("rediss://") ? {} : undefined,
    })
    // Without a listener ioredis emits an unhandled 'error' event and crashes the process
    queueConnection.on("error", error => {
        console.error("[facebookPublicationQueue] redis error:", error?.message || error)
    })

    queue = new Queue(FACEBOOK_QUEUE_NAME, { connection: queueConnection, defaultJobOptions: DEFAULT_JOB_OPTIONS })
    return queue
}

/**
 * Adds a publication job. The payload stays identifiers-only; the worker loads and re-checks the property.
 *
 * @param {{ propertyId: string, agencyId: string, revision: number }} request
 * @param {{ getQueueImpl?: () => Pick<Queue, "add"> }} [deps]
 * @returns {Promise<import('bullmq').Job>} The added (or already existing) job
 */
export const enqueueFacebookPublication = ({ propertyId, agencyId, revision }, { getQueueImpl = getQueue } = {}) =>
    getQueueImpl().add(JOB_NAME, { propertyId, agencyId }, { jobId: getFacebookPublicationJobId({ propertyId, revision }) })

/**
 * Closes the queue and its Redis connection, if one was ever opened
 * @returns {Promise<void>}
 */
export const closeFacebookPublicationQueue = async () => {
    if (!queue) return

    const [closingQueue, closingConnection] = [queue, queueConnection]
    queue = undefined
    queueConnection = undefined
    // BullMQ does not close a connection it was given, so it is quit separately
    await closingQueue.close()
    await closingConnection?.quit().catch(() => {})
}
