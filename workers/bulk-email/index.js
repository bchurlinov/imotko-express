import "dotenv/config"
import { createLogger } from "../facebook-property-publication/logger.js"
import { startWorkerProcess } from "../runtime.js"
import { startBulkEmailWorker } from "./worker.js"

const logger = createLogger()
// startWorkerProcess disconnects Prisma on shutdown; this worker never opens a database connection
const noDatabase = { $disconnect: async () => {} }

try {
    await startWorkerProcess({
        workerFactories: [() => startBulkEmailWorker({ logger })],
        prisma: noDatabase,
        logError: error => {
            logger.error("bulk_email_worker_shutdown_failed", { errorCode: error?.name || "unknown" })
        },
    })
} catch (error) {
    logger.error("bulk_email_worker_start_failed", {
        errorCode: error?.name || "unknown",
        reason: error.message,
    })
    process.exitCode = 1
}
