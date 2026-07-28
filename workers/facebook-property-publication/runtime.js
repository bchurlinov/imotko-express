export async function startFacebookWorker({ WorkerClass, connection, processor, logger }) {
    const worker = new WorkerClass("facebook-property-publication", processor, {
        connection,
        concurrency: 1,
        // BullMQ's defaults (5s block, 30s stalled sweep) assume Redis commands are
        // free. Upstash bills per command, and an idle worker still polls: measured
        // at ~81 ops/min on the defaults, which is 3.5M/month against a 500k quota.
        //
        // Long blocks cost nothing in pickup latency - `Queue.add` writes the marker
        // key the worker is already blocked on, so a queued job is picked up in ~5ms
        // regardless of drainDelay. Delayed jobs cap the block at 10s on their own.
        // 50s keeps the block under Upstash's 60s idle-connection timeout, so it is
        // never cut mid-flight.
        drainDelay: 50,
        // Only guards against this process dying mid-job. With concurrency 1 and a
        // single worker, 5 minutes to recover a stalled job is an acceptable trade
        // for 10x fewer sweeps.
        stalledInterval: 300_000,
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
