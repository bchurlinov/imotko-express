import assert from "node:assert/strict"
import { test } from "node:test"
import { runQueueCommand } from "./queue_control.js"

const createFakeQueue = ({ activeSequence = [0] } = {}) => {
    const calls = []
    let paused = false
    let reads = 0
    return {
        calls,
        async pause() {
            calls.push("pause")
            paused = true
        },
        async resume() {
            calls.push("resume")
            paused = false
        },
        async isPaused() {
            return paused
        },
        async getJobCounts() {
            const active = activeSequence[Math.min(reads, activeSequence.length - 1)]
            reads += 1
            return { active, waiting: 3, paused: 0, prioritized: 0, delayed: 0, failed: 0, completed: 9 }
        },
    }
}

const run = (queue, command, options = {}) => {
    const lines = []
    return runQueueCommand({ command, queue, log: line => lines.push(line), sleep: async () => {}, ...options }).then(
        code => ({ code, lines })
    )
}

test("status reads the queue without pausing or resuming it", async () => {
    const queue = createFakeQueue()
    const { code, lines } = await run(queue, "status")
    assert.equal(code, 0)
    assert.deepEqual(queue.calls, [])
    assert.match(lines.at(-1), /paused=false active=0 waiting=3/)
})

test("pause and resume change the global pause flag", async () => {
    const queue = createFakeQueue()
    assert.equal((await run(queue, "pause")).code, 0)
    assert.equal(await queue.isPaused(), true)
    assert.equal((await run(queue, "resume")).code, 0)
    assert.equal(await queue.isPaused(), false)
    assert.deepEqual(queue.calls, ["pause", "resume"])
})

test("drain pauses first and waits until no job is active", async () => {
    const queue = createFakeQueue({ activeSequence: [1, 1, 0] })
    const { code, lines } = await run(queue, "drain")
    assert.equal(code, 0)
    assert.deepEqual(queue.calls, ["pause"])
    assert.equal(lines.filter(line => line.startsWith("paused=true active=1")).length, 2)
    assert.match(lines.at(-1), /Drained/)
})

test("drain times out with a failing exit code and leaves the queue paused", async () => {
    const queue = createFakeQueue({ activeSequence: [1] })
    let clock = 0
    const { code, lines } = await run(queue, "drain", {
        now: () => clock,
        sleep: async ms => {
            clock += ms
        },
        drainTimeoutMs: 10_000,
        pollMs: 5_000,
    })
    assert.equal(code, 1)
    assert.equal(await queue.isPaused(), true)
    assert.match(lines.at(-1), /Timed out/)
})

test("unknown commands are rejected without touching the queue", async () => {
    const queue = createFakeQueue()
    const { code } = await run(queue, "flush")
    assert.equal(code, 2)
    assert.deepEqual(queue.calls, [])
})
