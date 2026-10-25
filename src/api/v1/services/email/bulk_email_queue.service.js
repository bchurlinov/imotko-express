import { Queue } from "bullmq"
import IORedis from "ioredis"
import {
    BULK_EMAIL_JOB_NAME,
    BULK_EMAIL_QUEUE_NAME,
    CAMPAIGN_TTL_SECONDS,
    campaignKey,
    claimKey,
    getBulkEmailJobId,
    readCampaignStatus,
} from "../../../../../workers/bulk-email/campaign_store.js"

/**
 * Producer side of the bulk admin email queue: imotko (Next, on Vercel) calls POST /api/v1/internal/bulk-email and
 * this module stores the campaign and adds one job per recipient. The bulk email worker sends them at 10/sec.
 *
 * @module services/email/bulk_email_queue
 */

// imotko gives up after 20s; a few thousand jobs go out in one pipeline well within this
export const BULK_ENQUEUE_TIMEOUT_MS = 10000
// A claim stays "pending" only this long, so a request that died mid-way (Redis dropped, cleanup failed) frees its
// campaign id by itself instead of answering "already queued" for 7 days. It becomes "queued" once every job is added.
export const PENDING_CLAIM_TTL_SECONDS = 60

const DEFAULT_JOB_OPTIONS = Object.freeze({
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
})

// AggregateError (e.g. ECONNREFUSED on both ::1 and 127.0.0.1) has an empty message, so log the code instead
const describeRedisError = error => error?.code || error?.message || String(error)

/** @type {Queue | undefined} */
let queue
/** @type {IORedis | undefined} */
let connection

const getConnection = () => {
    if (connection) return connection

    const url = process.env.UPSTASH_REDIS_URL?.trim()
    if (!url) throw new Error("UPSTASH_REDIS_URL is required to queue bulk emails")

    connection = new IORedis(url, {
        // Request path: fail the call instead of hanging it while Redis is down
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        tls: url.startsWith("rediss://") ? {} : undefined,
    })
    // Without a listener ioredis emits an unhandled 'error' event and crashes the process
    connection.on("error", error => {
        console.error("[bulkEmailQueue] redis error:", describeRedisError(error))
    })
    return connection
}

const getQueue = () => {
    if (queue) return queue

    queue = new Queue(BULK_EMAIL_QUEUE_NAME, { connection: getConnection(), defaultJobOptions: DEFAULT_JOB_OPTIONS })
    // The queue re-emits connection errors; already logged above, but an 'error' event needs a listener
    queue.on("error", () => {})
    return queue
}

// Redis commands wait for a connection without a deadline, so while Redis is down they would hang the request
const withTimeout = async (work, timeoutMs) => {
    let timer
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Redis did not answer within ${timeoutMs}ms`)), timeoutMs)
    })
    try {
        const running = work()
        // A late rejection after the timeout won must not become an unhandled rejection (fatal in app.js)
        running.catch(() => {})
        return await Promise.race([running, timeout])
    } finally {
        clearTimeout(timer)
    }
}

/**
 * Stores a campaign and queues its recipients. A campaign id is claimed once: a retried or double-clicked Send
 * returns the existing campaign and queues nothing (completed jobs are trimmed, so re-adding would send again).
 * While the first request is still adding jobs, a second one fails with code CAMPAIGN_PENDING (HTTP 409).
 *
 * @param {{ campaignId: string, subject: string, html: string, replyTo: string, deliveryMode: string,
 *   recipients: { email: string, unsubscribeLink: string }[], excluded: number }} campaign
 * @param {{ getConnection?: () => IORedis, getQueueImpl?: () => Pick<Queue, "addBulk">, timeoutMs?: number,
 *   now?: () => Date }} [deps]
 * @returns {Promise<{ campaignId: string, queued: number, excluded: number, duplicate: boolean }>}
 */
export const queueBulkEmailCampaign = (
    { campaignId, subject, html, replyTo, deliveryMode, recipients, excluded },
    {
        getConnection: getRedis = getConnection,
        getQueueImpl = getQueue,
        timeoutMs = BULK_ENQUEUE_TIMEOUT_MS,
        now = () => new Date(),
    } = {}
) =>
    withTimeout(async () => {
        const redis = getRedis()
        const claimed = await redis.set(claimKey(campaignId), "pending", "EX", PENDING_CLAIM_TTL_SECONDS, "NX")
        if (!claimed) {
            // Another request is still adding this campaign's jobs (or died doing so): not queued yet, so retry later
            if ((await redis.get(claimKey(campaignId))) !== "queued") {
                throw Object.assign(new Error("Campaign is still being queued"), { code: "CAMPAIGN_PENDING" })
            }
            const status = await readCampaignStatus(redis, campaignId)
            return { campaignId, queued: 0, excluded: status?.excluded ?? excluded, duplicate: true }
        }

        try {
            await redis
                .multi()
                .hset(campaignKey(campaignId), {
                    subject,
                    html,
                    replyTo,
                    deliveryMode,
                    total: recipients.length,
                    excluded,
                    sent: 0,
                    failed: 0,
                    createdAt: now().toISOString(),
                })
                .expire(campaignKey(campaignId), CAMPAIGN_TTL_SECONDS)
                .exec()
            await getQueueImpl().addBulk(
                recipients.map(({ email, unsubscribeLink }) => ({
                    name: BULK_EMAIL_JOB_NAME,
                    data: { campaignId, email, unsubscribeLink },
                    opts: { jobId: getBulkEmailJobId({ campaignId, email }) },
                }))
            )
            await redis.set(claimKey(campaignId), "queued", "EX", CAMPAIGN_TTL_SECONDS)
        } catch (error) {
            await redis.del(claimKey(campaignId), campaignKey(campaignId)).catch(() => {})
            throw error
        }

        return { campaignId, queued: recipients.length, excluded, duplicate: false }
    }, timeoutMs)

/**
 * @param {string} campaignId
 * @param {{ getConnection?: () => IORedis, timeoutMs?: number }} [deps]
 * @returns {Promise<Awaited<ReturnType<typeof readCampaignStatus>>>} null when unknown or expired
 */
export const getBulkEmailCampaignStatus = (
    campaignId,
    { getConnection: getRedis = getConnection, timeoutMs = 4000 } = {}
) => withTimeout(() => readCampaignStatus(getRedis(), campaignId), timeoutMs)

/**
 * Closes the queue and its Redis connection, if one was ever opened
 * @returns {Promise<void>}
 */
export const closeBulkEmailQueue = async () => {
    const [closingQueue, closingConnection] = [queue, connection]
    queue = undefined
    connection = undefined
    // BullMQ does not close a connection it was given, so it is quit separately
    await closingQueue?.close()
    await closingConnection?.quit().catch(() => {})
}
