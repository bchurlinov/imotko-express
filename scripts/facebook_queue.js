import "dotenv/config"
import { Queue } from "bullmq"
import IORedis from "ioredis"
import {
    FACEBOOK_QUEUE_NAME,
    QUEUE_COMMANDS,
    runQueueCommand,
} from "../workers/facebook-property-publication/queue_control.js"
import { assertRedisUrl, redisTlsOptions } from "../workers/facebook-property-publication/redis_url.js"

// Usage: pnpm queue:facebook <status|pause|resume|drain>
// Worker handoff: drain -> stop old worker (wait for facebook_worker_stopped) -> start new worker -> resume.
// Needs UPSTASH_REDIS_URL (rediss://, or redis:// to an internal host such as imotko-redis); inside the API
// container it is already set.
const command = process.argv[2]

if (!QUEUE_COMMANDS.includes(command)) {
    console.log(`Usage: pnpm queue:facebook <${QUEUE_COMMANDS.join("|")}>`)
    process.exit(2)
}

const redisUrl = process.env.UPSTASH_REDIS_URL?.trim()
try {
    assertRedisUrl(redisUrl ?? "")
} catch (error) {
    console.error(error.message)
    process.exit(2)
}

// Unlike the worker, an operator command must fail fast instead of retrying forever when Redis is unreachable
const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10_000,
    retryStrategy: attempt => (attempt > 3 ? null : attempt * 1000),
    tls: redisTlsOptions(redisUrl),
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
