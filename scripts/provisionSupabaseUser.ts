#!/usr/bin/env tsx
import { createSupabaseClient, supabaseAdmin } from "../src/utils/supabaseClient.js"

type CliOptions = {
    email?: string
    password?: string
}

const parseOptions = (): CliOptions => {
    const args = process.argv.slice(2)
    return args.reduce<CliOptions>((options, arg) => {
        if (!arg.startsWith("--")) return options
        const [rawKey, rawValue] = arg.replace(/^--/, "").split("=")
        const key = rawKey?.trim()
        const value = rawValue?.trim()

        if (!key || !value) return options

        if (key === "email") options.email = value
        if (key === "password") options.password = value
        return options
    }, {})
}

const requireOption = (value: string | undefined, name: string): string => {
    if (!value) {
        console.error(`Missing required option --${name}. Example usage:`)
        console.error("pnpm exec tsx scripts/provisionSupabaseUser.ts --email=user@example.com --password=Supabase123!")
        process.exit(1)
    }
    return value
}

const createUserIfNeeded = async (email: string, password: string): Promise<void> => {
    const result = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    })

    if (!result.error) {
        console.log(`[Supabase] Created new user for ${email} (id: ${result.data.user?.id ?? "unknown"})`)
        return
    }

    const error = result.error as Error & { status?: number; code?: string }

    if (error.status === 422 || error.message?.toLowerCase().includes("already registered")) {
        console.log(`[Supabase] User already exists for ${email}`)
        return
    }

    throw new Error(`Failed to create Supabase user: ${error.message ?? "Unknown error"}`)
}

const signInAndPrintToken = async (email: string, password: string) => {
    const client = createSupabaseClient()
    const { data, error } = await client.auth.signInWithPassword({ email, password })

    if (error || !data.session) {
        throw new Error(`Failed to obtain Supabase session: ${error?.message ?? "Unknown error"}`)
    }

    console.log(`[Supabase] User ID: ${data.user?.id ?? "unknown"}`)
    console.log(`[Supabase] Access token: ${data.session.access_token}`)
    console.log(`[Supabase] Refresh token: ${data.session.refresh_token ?? "(not provided)"}`)
}

const main = async (): Promise<void> => {
    const options = parseOptions()
    const email = requireOption(options.email ?? process.env.SUPABASE_TEST_EMAIL, "email")
    const password = requireOption(options.password ?? process.env.SUPABASE_TEST_PASSWORD, "password")

    await createUserIfNeeded(email, password)
    await signInAndPrintToken(email, password)
}

main().catch((error) => {
    console.error("[Supabase] Script failed:", error instanceof Error ? error.message : error)
    process.exit(1)
})
