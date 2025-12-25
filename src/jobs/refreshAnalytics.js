import cron from "node-cron"
import prisma from "#database/client.js"

let analyticsJobTask = null

export const scheduleAnalyticsRefresh = () => {
    analyticsJobTask = cron.schedule("0 0 * * 0", async () => {
        try {
            console.log("[Analytics] Refreshing materialized views...")
            await prisma.$executeRaw`SELECT refresh_analytics_views()`
            console.log("[Analytics] Materialized views refreshed successfully")
        } catch (error) {
            console.error("[Analytics] Failed to refresh views:", error)
        }
    })

    console.log("[Analytics] Scheduled job registered: Refresh every 30 minutes")
}

/**
 * Graceful shutdown - stops the analytics refresh cron job
 */
export const stopAnalyticsRefreshJob = () => {
    if (analyticsJobTask) {
        analyticsJobTask.stop()
        console.log("[Analytics] 🛑 Cron job stopped")
    }
}
