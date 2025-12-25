import { triggerImportManually } from "../src/jobs/schedulePropertyImport.js"

const triggeredBy = process.argv[2] || "manual"

try {
    await triggerImportManually(triggeredBy)
    process.exit(0)
} catch (error) {
    console.error("[PropertyImport] ❌ Manual import failed:", error)
    process.exit(1)
}

// npx tsx scripts/run_property_import.js
