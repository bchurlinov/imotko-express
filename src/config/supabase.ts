import "dotenv/config"

type SupabaseEnvKey =
    | "SUPABASE_URL"
    | "SUPABASE_ANON_KEY"
    | "SUPABASE_SERVICE_ROLE_KEY"
    | "SUPABASE_JWT_SECRET"
    | "SUPABASE_JWKS_URL"

const getEnvValue = (key: SupabaseEnvKey): string => {
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

export type SupabaseConfig = typeof supabaseConfig

export const getSupabaseConfig = (): SupabaseConfig => supabaseConfig
export const getSupabaseUrl = (): string => supabaseConfig.url
export const getSupabaseAnonKey = (): string => supabaseConfig.anonKey
export const getSupabaseServiceRoleKey = (): string => supabaseConfig.serviceRoleKey
export const getSupabaseJwtSecret = (): string => supabaseConfig.jwtSecret
export const getSupabaseJwksUrl = (): string => supabaseConfig.jwksUrl
