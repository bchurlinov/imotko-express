const shutdownRuntimes = async runtimes => {
    let firstError
    for (const runtime of [...runtimes].reverse()) {
        try {
            await runtime.shutdown()
        } catch (error) {
            firstError ||= error
        }
    }
    if (firstError) throw firstError
}

export async function startWorkerProcess({ workerFactories, prisma, processRef = process, logError = console.error }) {
    const runtimes = []

    try {
        for (const createWorker of workerFactories) {
            runtimes.push(await createWorker())
        }
    } catch (startupError) {
        await shutdownRuntimes(runtimes).catch(error => logError(error))
        await prisma.$disconnect().catch(error => logError(error))
        throw startupError
    }

    let shutdownPromise
    const shutdown = () => {
        shutdownPromise ||= (async () => {
            let firstError
            try {
                await shutdownRuntimes(runtimes)
            } catch (error) {
                firstError = error
            }
            try {
                await prisma.$disconnect()
            } catch (error) {
                firstError ||= error
            }
            if (firstError) throw firstError
        })()
        return shutdownPromise
    }

    const shutdownFromSignal = () => {
        void shutdown().catch(error => {
            logError(error)
            processRef.exitCode = 1
        })
    }

    processRef.once("SIGTERM", shutdownFromSignal)
    processRef.once("SIGINT", shutdownFromSignal)

    return { shutdown }
}
