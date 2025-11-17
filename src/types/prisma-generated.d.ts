declare module "@prisma/client" {
  export type UserRole = "CLIENT" | "AGENCY" | "ADMIN"

  export type User = {
    id: string
    email: string
    hashedPassword: string | null
    refreshToken: string | null
    [key: string]: unknown
  }

  export type VerificationToken = {
    id: string
    email: string
    token: string
    expires: Date
    [key: string]: unknown
  }

  export class PrismaClient {
    constructor(options?: Record<string, unknown>)
    $transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T>
    [key: string]: any
  }
}
