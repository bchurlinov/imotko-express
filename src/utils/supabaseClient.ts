import type { Request } from "express"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { supabaseConfig } from "../config/supabase.js"

type GenericClient = SupabaseClient

const adminClientOptions = {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
    },
} as const

export const supabaseAdmin: GenericClient = createClient(
    supabaseConfig.url,
    supabaseConfig.serviceRoleKey,
    adminClientOptions,
)

export const createSupabaseClient = (accessToken?: string): GenericClient =>
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

// Helper that keeps request-scoped auth together when controllers need to talk back to Supabase
export const createRequestSupabaseClient = (req: Pick<Request, "headers">): GenericClient => {
    const bearer = req.headers.authorization
    const token = bearer?.startsWith("Bearer ") ? bearer.replace("Bearer ", "") : undefined

    return createSupabaseClient(token)
}
