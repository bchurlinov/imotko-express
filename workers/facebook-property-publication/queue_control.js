export const FACEBOOK_QUEUE_NAME = "facebook-property-publication"

export const QUEUE_COMMANDS = Object.freeze(["status", "pause", "resume", "drain"])

const COUNTED_STATES = ["active", "waiting", "paused", "prioritized", "delayed", "failed", "completed"]

export const DEFAULT_DRAIN_TIMEOUT_MS = 10 * 60_000
export const DEFAULT_DRAIN_POLL_MS = 5_000

export async function readQueueStatus(queue) {
    const [isPaused, counts] = await Promise.all([queue.isPaused(), queue.getJobCounts(...COUNTED_STATES)])
    return { isPaused, counts }
}

const formatStatus = ({ isPaused, counts }) =>
    `paused=${isPaused} ` + COUNTED_STATES.map(state => `${state}=${counts[state] ?? 0}`).join(" ")

/**
 * Operator commands for handing the Facebook worker over between hosts.
 * `pause` is global: every worker finishes its current job and starts no new one, while producers keep enqueueing.
 * `drain` pauses, then waits until no job is active, so a worker can be stopped without cutting a Meta publication.
 * @returns {Promise<number>} Process exit code
 */
export async function runQueueCommand({
    command,
    queue,
    log = console.log,
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    now = Date.now,
    drainTimeoutMs = DEFAULT_DRAIN_TIMEOUT_MS,
    pollMs = DEFAULT_DRAIN_POLL_MS,
}) {
    if (!QUEUE_COMMANDS.includes(command)) {
        log(`Unknown command "${command}". Use one of: ${QUEUE_COMMANDS.join(", ")}`)
        return 2
    }

    if (command === "pause" || command === "drain") {
        await queue.pause()
        log("Queue paused: running jobs finish, no new jobs start, new jobs keep queueing.")
    }

    if (command === "resume") {
        await queue.resume()
        log("Queue resumed.")
    }

    if (command !== "drain") {
        log(formatStatus(await readQueueStatus(queue)))
        return 0
    }

    const deadline = now() + drainTimeoutMs
    for (;;) {
        const status = await readQueueStatus(queue)
        log(formatStatus(status))
        if ((status.counts.active ?? 0) === 0) {
            log("Drained: no active jobs. Safe to stop the worker. The queue stays paused until `resume`.")
            return 0
        }
        if (now() >= deadline) {
            log("Timed out waiting for active jobs. The queue stays paused; check the worker logs before stopping it.")
            return 1
        }
        await sleep(pollMs)
    }
}
