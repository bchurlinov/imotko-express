import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../config/supabase.js";
const adminClientOptions = {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
};
export const supabaseAdmin = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, adminClientOptions);
export const createSupabaseClient = (accessToken) => createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
        persistSession: false,
        detectSessionInUrl: false,
    },
    global: accessToken
        ? {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
        : undefined,
});
// Helper that keeps request-scoped auth together when controllers need to talk back to Supabase
export const createRequestSupabaseClient = (req) => {
    const bearer = req.headers.authorization;
    const token = bearer?.startsWith("Bearer ") ? bearer.replace("Bearer ", "") : undefined;
    return createSupabaseClient(token);
};
