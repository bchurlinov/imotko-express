export const SWEEP_JOB_NAME = "sweep"

const SWEEP_SCHEDULER_ID = "property-ai-sweep"
const SWEEP_EVERY_MS = 900000
const STUCK_AFTER_MS = 15 * 60 * 1000
const GIVE_UP_AFTER_MS = 7 * 24 * 60 * 60 * 1000
export const SWEEP_LIMIT = 50

/**
 * Prisma filter for listings the AI step never finished: still PENDING for 15+ minutes (the first job or its
 * retries are not expected to take longer), but younger than 7 days so old failures are not retried forever.
 *
 * @param {Date} now
 * @returns {object}
 */
export const buildSweepWhere = now => ({
    aiStatus: "PENDING",
    status: "PENDING",
    updatedAt: {
        lt: new Date(now.getTime() - STUCK_AFTER_MS),
        gt: new Date(now.getTime() - GIVE_UP_AFTER_MS),
    },
})

/**
 * Re-queues stuck listings. The job id is per baseline, so a listing whose job is still waiting or retrying is
 * ignored by BullMQ. Never queues a Facebook post or photo ordering: the sweep only finishes the text.
 *
 * @param {object} deps
 * @param {(query: { where: object, take: number }) => Promise<{ id: string, updatedAt: Date }[]>} deps.findStuck
 * @param {(request: { propertyId: string, baselineUpdatedAt: number, orderPhotos: boolean }) => Promise<unknown>} deps.enqueue
 * @param {Date} [deps.now]
 * @param {{ info: Function, error: Function }} [deps.logger] - Receives counts, ids and error names only
 * @returns {Promise<number>} Number of jobs queued
 */
export async function runSweep({ findStuck, enqueue, now = new Date(), logger }) {
    const rows = await findStuck({ where: buildSweepWhere(now), take: SWEEP_LIMIT })

    let count = 0
    for (const row of rows) {
        try {
            await enqueue({ propertyId: row.id, baselineUpdatedAt: row.updatedAt.getTime(), orderPhotos: false })
            count += 1
        } catch (error) {
            // Name only: the message could carry request data
            logger?.error("property_ai_sweep_enqueue_failed", { propertyId: row.id, errorCode: error?.name || "unknown" })
        }
    }

    logger?.info("property_ai_sweep_done", { count })
    return count
}

/**
 * Registers the repeatable sweep job. Upserting makes every worker start idempotent.
 *
 * @param {{ upsertJobScheduler: Function }} queue
 * @returns {Promise<void>}
 */
export async function scheduleSweep(queue) {
    await queue.upsertJobScheduler(SWEEP_SCHEDULER_ID, { every: SWEEP_EVERY_MS }, { name: SWEEP_JOB_NAME })
}
