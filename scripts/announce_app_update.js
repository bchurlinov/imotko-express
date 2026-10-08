// One-off: tell people still on app 1.0.5 that 1.1.0 is out (design D §4.7, release step 8).
//   dotenv -e .env.production -- pnpm announce:app-update            → dry run, prints counts
//   dotenv -e .env.production -- pnpm announce:app-update --confirm  → sends
import prisma from "#database/client.js"
import { getAppConfig } from "#services/app/app_config.service.js"
import { announceAppUpdate } from "#services/app/app_update_announcement.service.js"

const confirm = process.argv.includes("--confirm")
const { latestVersion } = getAppConfig()
if (latestVersion === "1.0.5") {
    console.error("Set MOBILE_LATEST_VERSION to the released version (e.g. 1.1.0) first.")
    process.exit(1)
}

const result = await announceAppUpdate({ dryRun: !confirm, latestVersion })
console.log(confirm ? "Sent" : "Dry run (add --confirm to send)", { latestVersion, ...result })
await prisma.$disconnect()
