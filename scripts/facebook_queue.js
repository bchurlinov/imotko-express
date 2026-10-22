import "dotenv/config"
import { Queue } from "bullmq"
import IORedis from "ioredis"
import {
    FACEBOOK_QUEUE_NAME,
    QUEUE_COMMANDS,
    runQueueCommand,
} from "../workers/facebook-property-publication/queue_control.js"

// Usage: pnpm queue:facebook <status|pause|resume|drain>
// Worker handoff: drain -> stop old worker (wait for facebook_worker_stopped) -> start new worker -> resume.
// Needs UPSTASH_REDIS_URL (rediss://); inside the API container it is already set.
const command = process.argv[2]

if (!QUEUE_COMMANDS.includes(command)) {
    console.log(`Usage: pnpm queue:facebook <${QUEUE_COMMANDS.join("|")}>`)
    process.exit(2)
}

const redisUrl = process.env.UPSTASH_REDIS_URL?.trim()
if (!redisUrl || new URL(redisUrl).protocol !== "rediss:") {
    console.error("UPSTASH_REDIS_URL must be set to a rediss:// URL")
    process.exit(2)
}

// Unlike the worker, an operator command must fail fast instead of retrying forever when Upstash is unreachable
const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10_000,
    retryStrategy: attempt => (attempt > 3 ? null : attempt * 1000),
    tls: {},
})
connection.on("error", error => console.error("[facebook-queue] redis error:", error.message))
const queue = new Queue(FACEBOOK_QUEUE_NAME, { connection })

try {
    process.exitCode = await runQueueCommand({ command, queue })
} catch (error) {
    console.error("[facebook-queue] command failed:", error.message)
    process.exitCode = 1
} finally {
    await queue.close().catch(() => {})
    await connection.quit().catch(() => {})
}
