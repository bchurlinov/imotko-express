export async function startFacebookWorker({ WorkerClass, connection, processor, logger }) {
    const worker = new WorkerClass("facebook-property-publication", processor, {
        connection,
        concurrency: 1,
    })

    worker.on("completed", job => {
        logger.info("facebook_job_completed", { jobId: job.id, jobName: job.name })
    })
    worker.on("failed", (job, error) => {
        logger.error("facebook_job_failed", {
            jobId: job?.id,
            jobName: job?.name,
            propertyId: job?.data?.propertyId,
            agencyId: job?.data?.agencyId,
            attempt: job ? job.attemptsMade : null,
            errorCode: error?.errorCode || error?.name || "unknown",
            metaCode: error?.metaCode,
            metaSubcode: error?.metaSubcode,
            fbtraceId: error?.fbtraceId,
        })
    })
    worker.on("error", error => {
        logger.error("facebook_worker_error", { errorCode: error?.name || "unknown" })
    })

    try {
        await worker.waitUntilReady()
    } catch (error) {
        try {
            await worker.close()
        } catch {
            // The readiness failure is the actionable startup error.
        }
        throw error
    }
    logger.info("facebook_worker_started")

    let stopped = false
    return {
        worker,
        async shutdown() {
            if (stopped) return
            stopped = true
            logger.info("facebook_worker_stopping")
            let firstError
            for (const close of [() => worker.close(), () => connection.quit()]) {
                try {
                    await close()
                } catch (error) {
                    firstError ||= error
                }
            }
            logger.info("facebook_worker_stopped")
            if (firstError) throw firstError
        },
    }
}
