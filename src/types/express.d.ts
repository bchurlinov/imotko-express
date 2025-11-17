export interface SupabaseAuthUser {
    id: string
    email?: string
    role?: string
    aud?: string | string[]
    exp?: number
    appMetadata?: Record<string, unknown>
    userMetadata?: Record<string, unknown>
}

declare global {
    namespace Express {
        interface Request {
            user?: SupabaseAuthUser
        }
    }
}

export {}
