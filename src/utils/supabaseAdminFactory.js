import { createClient } from "@supabase/supabase-js"

// No config import and no process.env here on purpose: the import job loads this file without the API's Supabase vars.
const adminClientOptions = {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
}

/**
 * Supabase client with the service role key. The one place the admin client options live.
 * @param {{ url: string, key: string }} config
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export const createSupabaseAdminClient = ({ url, key }) => createClient(url, key, adminClientOptions)
