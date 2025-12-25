import { PrismaClient } from "../generated/prisma/client.ts";

const prisma = new PrismaClient();

/**
 * Seeds the database with initial data required for the property import system.
 * This includes:
 * - System user for automated property imports
 * - Default "Imported Listings" agency for imported properties
 */
async function main() {
    console.log("🌱 Starting database seeding...");

    // Create system user for property imports
    const systemUser = await prisma.user.upsert({
        where: { email: "system@imotko.mk" },
        update: {},
        create: {
            email: "system@imotko.mk",
            name: "System",
            lastName: "Import Bot",
            role: "ADMIN",
            language: "MK",
            emailVerified: new Date(),
        },
    });

    console.log(`✅ System user created/verified: ${systemUser.id}`);

    // Create default agency for imported listings
    const importAgency = await prisma.agency.upsert({
        where: { id: "imported-listings-agency" },
        update: {},
        create: {
            id: "imported-listings-agency",
            name: "Imported Listings",
            address: "Skopje, Macedonia",
            owner: systemUser.id,
            ownerId: systemUser.id,
            status: "APPROVED",
            imotkoApproved: true,
            plan: "BASIC",
            description: {
                mk: "Автоматски увезени огласи",
                en: "Automatically imported listings",
            },
        },
    });

    console.log(`✅ Import agency created/verified: ${importAgency.id}`);

    console.log("\n📋 Environment variable values:");
    console.log(`IMPORT_SYSTEM_USER_ID=${systemUser.id}`);
    console.log(`IMPORT_DEFAULT_AGENCY_ID=${importAgency.id}`);
    console.log(
        "\n💡 Copy these values to your .env file to complete the setup."
    );
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error("❌ Error during seeding:", e);
        await prisma.$disconnect();
        process.exit(1);
    });
