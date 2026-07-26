import { Worker } from "bullmq"
import { loadFacebookWorkerConfig } from "./config.js"
import { decryptMetaToken } from "./crypto.js"
import { createFacebookClient } from "./facebook.client.js"
import { createFacebookPropertyProcessor } from "./processor.js"
import { createPropertyRepository } from "./property.repository.js"
import { startFacebookWorker } from "./runtime.js"
import IORedis from "ioredis"
import prisma from "#database/client.js"

export async function startFacebookPropertyPublicationWorker({ logger }) {
    const config = loadFacebookWorkerConfig()
    let connection

    try {
        connection = new IORedis(config.redisUrl, {
            maxRetriesPerRequest: null,
            tls: {},
        })
        connection.on("error", error => {
            logger.error("facebook_redis_error", { errorCode: error?.name || "unknown" })
        })

        const repository = createPropertyRepository(prisma)
        const facebookClient = createFacebookClient({
            graphApiVersion: config.graphApiVersion,
            timeoutMs: config.requestTimeoutMs,
        })
        const processor = createFacebookPropertyProcessor({
            repository,
            facebookClient,
            decryptToken: decryptMetaToken,
            tokenEncryptionKey: config.tokenEncryptionKey,
            publicAppUrl: config.publicAppUrl,
            logger,
        })

        return await startFacebookWorker({
            WorkerClass: Worker,
            connection,
            processor,
            logger,
        })
    } catch (error) {
        if (connection) await connection.quit().catch(() => {})
        throw error
    }
}
