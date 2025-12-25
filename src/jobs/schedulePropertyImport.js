import { importProperties } from "./import_properties.js"
import cron from "node-cron"

/**
 * Scheduled property import job
 * Runs daily at midnight (00:00) to import properties from external source
 */

let importJobTask = null
let isJobRunning = false

/**
 * Wrapper function to prevent overlapping executions
 */
async function runImportJob() {
    if (isJobRunning) {
        console.log("[PropertyImport] ⚠️  Skipping scheduled run - previous job still running")
        return
    }

    isJobRunning = true
    console.log("[PropertyImport] 🚀 Starting scheduled import job...")

    try {
        await importProperties("cron")
        console.log("[PropertyImport] ✅ Scheduled import job completed")
    } catch (error) {
        console.error("[PropertyImport] ❌ Scheduled import job failed:", error)
    } finally {
        isJobRunning = false
    }
}

/**
 * Schedules the property import job
 * Default: Daily at midnight (00:00)
 * Can be customized via IMPORT_CRON_SCHEDULE environment variable
 */
export const schedulePropertyImport = () => {
    // Default: Daily at midnight '0 0 * * *'
    // Can be overridden via environment variable
    const cronSchedule = process.env.IMPORT_CRON_SCHEDULE || "0 0 * * *"

    // Validate cron expression
    if (!cron.validate(cronSchedule)) {
        console.error(`[PropertyImport] ❌ Invalid cron schedule: "${cronSchedule}"`)
        console.error("[PropertyImport] ℹ️  Job will not be scheduled. Fix IMPORT_CRON_SCHEDULE in .env")
        return null
    }

    // Task 7.1.4: Register job in application startup
    importJobTask = cron.schedule(
        cronSchedule,
        async () => {
            await runImportJob()
        },
        {
            scheduled: true,
            timezone: process.env.TZ || "Europe/Skopje", // Default to Skopje timezone
        }
    )

    console.log(
        `[PropertyImport] ✅ Scheduled job registered: "${cronSchedule}" (${process.env.TZ || "Europe/Skopje"})`
    )
    console.log("[PropertyImport] ℹ️  To change schedule, set IMPORT_CRON_SCHEDULE in .env")

    return importJobTask
}

/**
 * Task 7.1.6: Manually trigger the import job
 * Can be called from API endpoint or CLI
 * @param {string} triggeredBy - Who triggered the job ("api", "manual", "cron")
 * @returns {Promise<Object>} Import results
 */
export const triggerImportManually = async (triggeredBy = "manual") => {
    if (isJobRunning) throw new Error("Import job is already running")
    console.log(`[PropertyImport] 🚀 Manual trigger initiated by: ${triggeredBy}`)
    isJobRunning = true

    try {
        const result = await importProperties(triggeredBy)
        console.log("[PropertyImport] ✅ Manual import completed")
        return result
    } catch (error) {
        console.error("[PropertyImport] ❌ Manual import failed:", error)
        throw error
    } finally {
        isJobRunning = false
    }
}

/**
 * Task 7.1.5: Graceful shutdown - stops the cron job
 * Returns a promise that resolves when any running job completes
 */
export const stopPropertyImportJob = async () => {
    if (importJobTask) {
        importJobTask.stop()
        console.log("[PropertyImport] 🛑 Cron job stopped")
    }

    // Wait for running job to complete (with timeout)
    if (isJobRunning) {
        console.log("[PropertyImport] ⚠️  Job is currently running. Waiting for completion...")
        const maxWaitTime = 10000 // 10 seconds
        const startTime = Date.now()

        while (isJobRunning && Date.now() - startTime < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 100))
        }

        if (isJobRunning) {
            console.log("[PropertyImport] ⚠️  Job still running after timeout, proceeding with shutdown")
        } else {
            console.log("[PropertyImport] ✅ Running job completed")
        }
    }
}

/**
 * Gets the current job status
 * @returns {Object} Job status information
 */
export const getJobStatus = () => {
    return {
        isRunning: isJobRunning,
        isScheduled: importJobTask ? true : false,
        schedule: process.env.IMPORT_CRON_SCHEDULE || "0 0 * * *",
        timezone: process.env.TZ || "Europe/Skopje",
    }
}
