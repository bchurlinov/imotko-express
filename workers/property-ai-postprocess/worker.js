import { Worker } from "bullmq"
import IORedis from "ioredis"
import prisma from "#database/client.js"
import {
    STORED_PROPERTY_SELECT,
    enrichStoredProperty,
    toFailurePatch,
    writeIfUnchanged,
} from "#shared/ai/property_postprocess.js"
import {
    closeFacebookPublicationQueue,
    enqueueFacebookPublication,
} from "#services/properties/facebook_publication_queue.service.js"
import {
    closePropertyAiQueue,
    enqueuePropertyAi,
    getPropertyAiQueue,
} from "#services/properties/property_ai_queue.service.js"
import { notifyTemplates } from "#utils/templates_revalidation.js"
import { redisErrorFields } from "../facebook-property-publication/logger.js"
import { redisTlsOptions } from "../facebook-property-publication/redis_url.js"
import { loadPropertyAiWorkerConfig } from "./config.js"
import { orderPropertyPhotos } from "./photo_order.js"
import { createPropertyAiProcessor } from "./processor.js"
import { PROPERTY_AI_QUEUE_NAME } from "./queue_name.js"
import { createWebRevalidator } from "./revalidate.js"
import { runSweep, scheduleSweep } from "./sweep.js"

const createRedisConnection = url =>
    new IORedis(url, {
        maxRetriesPerRequest: null,
        tls: redisTlsOptions(url),
    })

const closeQueues = async () => {
    let firstError
    for (const close of [closeFacebookPublicationQueue, closePropertyAiQueue]) {
        try {
            await close()
        } catch (error) {
            firstError ||= error
        }
    }
    if (firstError) throw firstError
}

/**
 * Starts the BullMQ worker that post-processes saved properties (AI text, photo order) and chains the Facebook post.
 *
 * `env`, `WorkerClass`, `createConnection` and `closeQueues` default to the real thing; they are parameters so
 * the start/stop sequence can be tested without Redis.
 *
 * @param {{ logger: { info: Function, error: Function }, env?: object, WorkerClass?: typeof Worker,
 *   createConnection?: (url: string) => IORedis, closeQueues?: () => Promise<void>,
 *   getQueue?: () => Pick<import('bullmq').Queue, "upsertJobScheduler"> }} options
 * @returns {Promise<{ worker: Worker, shutdown: () => Promise<void> }>}
 */
export async function startPropertyAiWorker({
    logger,
    env = process.env,
    WorkerClass = Worker,
    createConnection = createRedisConnection,
    closeQueues: closeProducerQueues = closeQueues,
    getQueue = getPropertyAiQueue,
}) {
    const config = loadPropertyAiWorkerConfig(env)
    let connection

    try {
        connection = createConnection(config.redisUrl)
        connection.on("error", error => {
            logger.error("property_ai_redis_error", redisErrorFields(error))
        })

        const processor = createPropertyAiProcessor({
            loadProperty: propertyId =>
                prisma.property.findUnique({ where: { id: propertyId }, select: STORED_PROPERTY_SELECT }),
            enrichStored: enrichStoredProperty,
            // Photo ordering is best effort: a failure keeps the current order and never fails the text job
            orderPhotos: (property, options) =>
                orderPropertyPhotos(property, options).catch(error => {
                    logger.error("property_ai_photo_order_failed", { errorCode: error?.name || "unknown" })
                    return null
                }),
            writeIfUnchanged,
            toFailurePatch,
            revalidate: createWebRevalidator({
                webUrl: config.webUrl,
                internalSecret: config.internalSecret,
                logger,
            }),
            notifyTemplates,
            enqueueFacebook: enqueueFacebookPublication,
            sweep: () =>
                runSweep({
                    findStuck: ({ where, take }) =>
                        prisma.property.findMany({
                            where,
                            orderBy: { updatedAt: "asc" },
                            take,
                            select: { id: true, updatedAt: true },
                        }),
                    enqueue: enqueuePropertyAi,
                    logger,
                }),
            logger,
        })

        const worker = new WorkerClass(PROPERTY_AI_QUEUE_NAME, processor, {
            connection,
            concurrency: 2,
            // Same polling trade-off as the Facebook worker: a long block costs nothing in pickup latency (Queue.add
            // wakes it) and keeps idle Redis commands low; a stalled job is only the process dying mid-job.
            drainDelay: 50,
            stalledInterval: 300_000,
        })

        worker.on("completed", job => {
            logger.info("property_ai_job_completed", { jobId: job.id, jobName: job.name })
        })
        worker.on("failed", (job, error) => {
            // Name and status only: an AI SDK error carries the full request, which holds the listing text
            logger.error("property_ai_job_failed", {
                jobId: job?.id,
                jobName: job?.name,
                propertyId: job?.data?.propertyId,
                attempt: job ? job.attemptsMade : null,
                errorCode: error?.name || "unknown",
                status: error?.statusCode,
            })
        })
        worker.on("error", error => {
            logger.error("property_ai_worker_error", redisErrorFields(error))
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
        logger.info("property_ai_worker_started")

        // The sweep is a safety net: failing to register it must not take the worker down
        try {
            await scheduleSweep(getQueue())
        } catch (error) {
            logger.error("property_ai_sweep_schedule_failed", { errorCode: error?.name || "unknown" })
        }

        let stopped = false
        return {
            worker,
            async shutdown() {
                if (stopped) return
                stopped = true
                logger.info("property_ai_worker_stopping")
                let firstError
                for (const close of [() => worker.close(), () => connection.quit(), closeProducerQueues]) {
                    try {
                        await close()
                    } catch (error) {
                        firstError ||= error
                    }
                }
                logger.info("property_ai_worker_stopped")
                if (firstError) throw firstError
            },
        }
    } catch (error) {
        if (connection) await connection.quit().catch(() => {})
        throw error
    }
}
