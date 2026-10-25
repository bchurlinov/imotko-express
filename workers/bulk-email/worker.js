import { Worker } from "bullmq"
import IORedis from "ioredis"
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses"
import { redisErrorFields } from "../facebook-property-publication/logger.js"
import { redisTlsOptions } from "../facebook-property-publication/redis_url.js"
import { loadBulkEmailWorkerConfig } from "./config.js"
import { createBulkEmailProcessor } from "./processor.js"
import { startBulkEmailWorker as startRuntime } from "./runtime.js"

export async function startBulkEmailWorker({ logger }) {
    const config = loadBulkEmailWorkerConfig()
    let connection

    try {
        connection = new IORedis(config.redisUrl, {
            maxRetriesPerRequest: null,
            tls: redisTlsOptions(config.redisUrl),
        })
        connection.on("error", error => {
            logger.error("bulk_email_redis_error", redisErrorFields(error))
        })

        const ses = new SESClient(config.ses)
        const sendRawEmail = ({ raw, destinations, from }) =>
            ses.send(new SendRawEmailCommand({ Destinations: destinations, RawMessage: { Data: Buffer.from(raw) }, Source: from }))

        return await startRuntime({
            WorkerClass: Worker,
            connection,
            processorFactory: ({ onThrottle }) =>
                createBulkEmailProcessor({ redis: connection, sendRawEmail, from: config.from, onThrottle }),
            logger,
        })
    } catch (error) {
        if (connection) await connection.quit().catch(() => {})
        throw error
    }
}
