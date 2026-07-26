import assert from "node:assert/strict"
import { test } from "node:test"
import { startWorkerProcess } from "./runtime.js"

const createProcess = () => {
    const handlers = new Map()
    return {
        exitCode: 0,
        once(signal, handler) {
            handlers.set(signal, handler)
        },
        emit(signal) {
            return handlers.get(signal)?.()
        },
    }
}

test("starts every registered worker and shuts down workers before Prisma", async () => {
    const lifecycle = []
    const processRef = createProcess()
    const prisma = { $disconnect: async () => lifecycle.push("prisma.$disconnect") }

    const runtime = await startWorkerProcess({
        workerFactories: [
            async () => ({ shutdown: async () => lifecycle.push("facebook.shutdown") }),
            async () => ({ shutdown: async () => lifecycle.push("email.shutdown") }),
        ],
        prisma,
        processRef,
        logError: () => {},
    })

    await runtime.shutdown()
    await runtime.shutdown()

    assert.deepEqual(lifecycle, ["email.shutdown", "facebook.shutdown", "prisma.$disconnect"])
})

test("cleans up started workers and Prisma when a later worker cannot start", async () => {
    const lifecycle = []
    const startupError = new Error("email configuration is invalid")

    await assert.rejects(
        startWorkerProcess({
            workerFactories: [
                async () => ({ shutdown: async () => lifecycle.push("facebook.shutdown") }),
                async () => {
                    throw startupError
                },
            ],
            prisma: { $disconnect: async () => lifecycle.push("prisma.$disconnect") },
            processRef: createProcess(),
            logError: () => {},
        }),
        error => error === startupError
    )

    assert.deepEqual(lifecycle, ["facebook.shutdown", "prisma.$disconnect"])
})
