import "dotenv/config"
import { createLogger } from "./facebook-property-publication/logger.js"
import { startFacebookPropertyPublicationWorker } from "./facebook-property-publication/worker.js"
import { startWorkerProcess } from "./runtime.js"
import prisma from "#database/client.js"

const logger = createLogger()

try {
    await startWorkerProcess({
        workerFactories: [() => startFacebookPropertyPublicationWorker({ logger })],
        prisma,
        logError: error => {
            logger.error("workers_shutdown_failed", { errorCode: error?.name || "unknown" })
        },
    })
} catch (error) {
    logger.error("workers_start_failed", {
        errorCode: error?.name || "unknown",
        reason: error.message,
    })
    process.exitCode = 1
}
