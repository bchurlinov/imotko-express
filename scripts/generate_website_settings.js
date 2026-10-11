import "dotenv/config"
import prisma from "#database/client.js"

async function generateWebsiteSettings() {
    try {
        // Find all agencies that don't have website settings yet
        const agenciesWithoutSettings = await prisma.agency.findMany({
            where: {
                websiteSettings: null,
            },
            select: {
                id: true,
                name: true,
            },
        })

        if (agenciesWithoutSettings.length === 0) {
            console.log("✅ All agencies already have website settings!")
            return
        }

        console.log(`📋 Found ${agenciesWithoutSettings.length} agencies without website settings:\n`)

        // Create website settings for each agency
        for (const agency of agenciesWithoutSettings) {
            await prisma.agencyWebsiteSettings.create({
                data: {
                    agencyId: agency.id,
                    enableRentals: true,
                    enableShortTermRentals: false,
                    serviceAreas: ["ohrid", "skopje"],
                    template: "default",
                    primaryColor: "#c72424",
                    accentColor: "#b29c9c",
                    secondaryColor: "#dfa9f1",
                    siteTitle: "Test site title",
                    tagline: "Test tagline",
                    heroTitle: "Test hero title",
                    heroSubtitle: "Test hero subtitle",
                },
            })
            console.log(`  ✅ Created settings for: ${agency.name} (${agency.id})`)
        }

        console.log(`\n🎉 Successfully created website settings for ${agenciesWithoutSettings.length} agencies!`)
    } catch (error) {
        console.error("❌ Error generating website settings:", error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

generateWebsiteSettings()
// npx tsx scripts/generate_website_settings.js
