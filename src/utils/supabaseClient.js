import { createClient } from "@supabase/supabase-js"
import { supabaseConfig } from "../config/supabase.js"

const adminClientOptions = {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
}

/**
 * Supabase admin client with service role key
 * @type {import('@supabase/supabase-js').SupabaseClient}
 */
export const supabaseAdmin = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, adminClientOptions)

/**
 * Create a Supabase client with optional access token
 * @param {string} [accessToken] - Optional access token for authenticated requests
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export const createSupabaseClient = accessToken =>
    createClient(supabaseConfig.url, supabaseConfig.anonKey, {
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
    })

/**
 * Create a request-scoped Supabase client from Express request
 * @param {Pick<import('express').Request, 'headers'>} req - Express request object
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export const createRequestSupabaseClient = req => {
    const bearer = req.headers.authorization
    const token = bearer?.startsWith("Bearer ") ? bearer.replace("Bearer ", "") : undefined

    return createSupabaseClient(token)
}
