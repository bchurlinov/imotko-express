import cron from "node-cron"
import prisma from "#database/client.js"

export const scheduleAnalyticsRefresh = () => {
    // Refresh analytics views every 30 minutes
    // Cron pattern: '*/30 * * * *' means:
    // - */30: Every 30 minutes
    // - *: Every hour
    // - *: Every day of month
    // - *: Every month
    // - *: Every day of week
    cron.schedule("*/30 * * * *", async () => {
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
