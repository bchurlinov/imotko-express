import "dotenv/config"
import prisma from "#database/client.js"

async function main() {
    try {
        console.log("[Analytics] Refreshing materialized views...")
        await prisma.$executeRaw`SELECT refresh_analytics_views()`
        console.log("[Analytics] Materialized views refreshed successfully")
    } catch (error) {
        console.error("[Analytics] Failed to refresh views:", error)
        process.exitCode = 1
    } finally {
        console.log("[Analytics] Disconnecting Prisma...")
        await prisma.$disconnect()
    }
}

main()
