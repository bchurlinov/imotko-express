import "dotenv/config";
const getEnvValue = (key) => {
    const value = process.env[key];
    if (!value)
        throw new Error(`[Supabase Config] Missing required environment variable: ${key}`);
    return value;
};
export const supabaseConfig = {
    url: getEnvValue("SUPABASE_URL"),
    anonKey: getEnvValue("SUPABASE_ANON_KEY"),
    serviceRoleKey: getEnvValue("SUPABASE_SERVICE_ROLE_KEY"),
    jwtSecret: getEnvValue("SUPABASE_JWT_SECRET"),
    jwksUrl: getEnvValue("SUPABASE_JWKS_URL"),
};
export const getSupabaseConfig = () => supabaseConfig;
export const getSupabaseUrl = () => supabaseConfig.url;
export const getSupabaseAnonKey = () => supabaseConfig.anonKey;
export const getSupabaseServiceRoleKey = () => supabaseConfig.serviceRoleKey;
export const getSupabaseJwtSecret = () => supabaseConfig.jwtSecret;
export const getSupabaseJwksUrl = () => supabaseConfig.jwksUrl;
