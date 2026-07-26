import "dotenv/config"
import prisma from "#database/client.js"
import { startWorkerProcess } from "../runtime.js"
import { createLogger } from "./logger.js"
import { startFacebookPropertyPublicationWorker } from "./worker.js"

const logger = createLogger()

try {
    await startWorkerProcess({
        workerFactories: [() => startFacebookPropertyPublicationWorker({ logger })],
        prisma,
        logError: error => {
            logger.error("facebook_worker_shutdown_failed", { errorCode: error?.name || "unknown" })
        },
    })
} catch (error) {
    logger.error("facebook_worker_start_failed", {
        errorCode: error?.name || "unknown",
        reason: error.message,
    })
    process.exitCode = 1
}
