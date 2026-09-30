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
            chatViewer?:
                | { type: "client"; userId: string }
                | {
                      type: "agency"
                      userId: string
                      agencyId: string
                      memberId: string
                      role: string
                  }
                | { type: "admin"; userId: string }
            chatUser?: Record<string, unknown>
            supabaseUser?: Record<string, unknown>
        }
    }
}

export {}
