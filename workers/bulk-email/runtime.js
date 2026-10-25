import { redisErrorFields } from "../facebook-property-publication/logger.js"
import { BULK_EMAIL_QUEUE_NAME, recordFailed } from "./campaign_store.js"

// 10 emails/sec, spread evenly. SES's account limit is ~14/sec and other emails (chat, leads, transactional) share it.
// BullMQ's limiter uses fixed windows, so { max: 10, duration: 1000 } can send 20 within one second (10 at the end of a
// window, 10 at the start of the next); one email per 100 ms keeps any second at 10-11.
export const SEND_RATE_LIMIT = Object.freeze({ max: 1, duration: 100 })
// How long the whole queue waits after SES says "slow down"
export const THROTTLE_PAUSE_MS = 2000

// SES messages can name the address ("Email address is not verified: x@y.mk")
const redactEmails = message => message.replace(/[^\s<>"',;:]+@[^\s<>"',;:]+/g, "[email]")

const isFinalFailure = (job, error) =>
    error?.name === "UnrecoverableError" || job.attemptsMade >= (job.opts?.attempts ?? 1)

/**
 * @param {{ WorkerClass: typeof import('bullmq').Worker, connection: import('ioredis').default,
 *   processorFactory: (deps: { onThrottle: () => Promise<never> }) => (job: import('bullmq').Job) => Promise<void>,
 *   logger: ReturnType<typeof import('../facebook-property-publication/logger.js').createLogger> }} options
 */
export async function startBulkEmailWorker({ WorkerClass, connection, processorFactory, logger }) {
    let worker
    // A rate-limit error puts the job back without using one of its attempts, and the limiter pauses the queue
    const onThrottle = async () => {
        await worker.rateLimit(THROTTLE_PAUSE_MS)
        throw WorkerClass.RateLimitError()
    }
    const processor = processorFactory({ onThrottle })

    worker = new WorkerClass(BULK_EMAIL_QUEUE_NAME, processor, {
        connection,
        // Concurrency only lets the limiter be reached when SES answers slowly; the limiter sets the pace
        concurrency: 10,
        limiter: SEND_RATE_LIMIT,
    })

    // No addresses in logs: the campaign and job id are enough to find an email in Redis
    worker.on("failed", async (job, error) => {
        if (!job) return
        const final = isFinalFailure(job, error)
        logger.error("bulk_email_job_failed", {
            jobId: job.id,
            campaignId: job.data?.campaignId,
            attempt: job.attemptsMade,
            errorCode: error?.name || "unknown",
            reason: typeof error?.message === "string" ? redactEmails(error.message).slice(0, 160) : undefined,
            status: final ? "final" : "will-retry",
        })
        if (final) {
            await recordFailed(connection, job.data.campaignId, job.data.email).catch(recordError => {
                logger.error("bulk_email_record_failed", redisErrorFields(recordError))
            })
        }
    })
    worker.on("error", error => {
        logger.error("bulk_email_worker_error", redisErrorFields(error))
    })

    try {
        await worker.waitUntilReady()
    } catch (error) {
        try {
            await worker.close()
        } catch {
            // The readiness failure is the actionable startup error.
        }
        throw error
    }
    logger.info("bulk_email_worker_started")

    let stopped = false
    return {
        worker,
        async shutdown() {
            if (stopped) return
            stopped = true
            logger.info("bulk_email_worker_stopping")
            let firstError
            // close() waits for emails being sent right now, so none is cut off mid-send
            for (const close of [() => worker.close(), () => connection.quit()]) {
                try {
                    await close()
                } catch (error) {
                    firstError ||= error
                }
            }
            logger.info("bulk_email_worker_stopped")
            if (firstError) throw firstError
        },
    }
}
