import dotenv from "dotenv";

dotenv.config();

/**
 * Configuration for the property import job
 * Loaded from environment variables
 */
export const importConfig = {
    // Data source configuration
    dataSourceUrl:
        process.env.IMPORT_DATA_SOURCE_URL ||
        "https://globalracecalendar.com/imotko/delta.json",

    // System user and agency IDs
    systemUserId: process.env.IMPORT_SYSTEM_USER_ID,
    defaultAgencyId: process.env.IMPORT_DEFAULT_AGENCY_ID,

    // Processing configuration
    batchSize: parseInt(process.env.IMPORT_BATCH_SIZE || "10", 10),
    testMode: process.env.IMPORT_TEST_MODE === "true",

    // AI configuration
    openaiApiKey: process.env.OPENAI_API_KEY,

    // Supabase configuration
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

    // Validation
    isValid() {
        const required = {
            openaiApiKey: this.openaiApiKey,
            supabaseUrl: this.supabaseUrl,
            supabaseServiceRoleKey: this.supabaseServiceRoleKey,
        };

        // Check required fields
        for (const [key, value] of Object.entries(required)) {
            if (!value) {
                throw new Error(
                    `Missing required environment variable for ${key}`
                );
            }
        }

        // Warn about optional but recommended fields
        if (!this.systemUserId) {
            console.warn(
                "⚠️  IMPORT_SYSTEM_USER_ID not set - properties will not have a createdBy user"
            );
        }

        if (!this.defaultAgencyId) {
            console.warn(
                "⚠️  IMPORT_DEFAULT_AGENCY_ID not set - properties will not be assigned to an agency"
            );
        }

        return true;
    },
};
