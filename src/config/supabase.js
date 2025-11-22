import "dotenv/config"

/**
 * Get environment variable value
 * @param {string} key - Environment variable key
 * @returns {string}
 * @throws {Error} If environment variable is missing
 */
const getEnvValue = (key) => {
    const value = process.env[key]
    if (!value) throw new Error(`[Supabase Config] Missing required environment variable: ${key}`)
    return value
}

export const supabaseConfig = {
    url: getEnvValue("SUPABASE_URL"),
    anonKey: getEnvValue("SUPABASE_ANON_KEY"),
    serviceRoleKey: getEnvValue("SUPABASE_SERVICE_ROLE_KEY"),
    jwtSecret: getEnvValue("SUPABASE_JWT_SECRET"),
    jwksUrl: getEnvValue("SUPABASE_JWKS_URL"),
}

/**
 * Get complete Supabase configuration
 * @returns {typeof supabaseConfig}
 */
export const getSupabaseConfig = () => supabaseConfig

/**
 * Get Supabase URL
 * @returns {string}
 */
export const getSupabaseUrl = () => supabaseConfig.url

/**
 * Get Supabase anonymous key
 * @returns {string}
 */
export const getSupabaseAnonKey = () => supabaseConfig.anonKey

/**
 * Get Supabase service role key
 * @returns {string}
 */
export const getSupabaseServiceRoleKey = () => supabaseConfig.serviceRoleKey

/**
 * Get Supabase JWT secret
 * @returns {string}
 */
export const getSupabaseJwtSecret = () => supabaseConfig.jwtSecret

/**
 * Get Supabase JWKS URL
 * @returns {string}
 */
export const getSupabaseJwksUrl = () => supabaseConfig.jwksUrl
