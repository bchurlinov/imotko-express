import { PrismaClient } from "#generated/prisma/client.ts"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DATABASE_POOL_MAX || "3", 10),
    connectionTimeoutMillis: parseInt(process.env.DATABASE_POOL_ACQUIRE_TIMEOUT_MS || "20000", 10),
    idleTimeoutMillis: parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS || "10000", 10),
})

const prisma = new PrismaClient({
    adapter,
    log: [
        { emit: "stdout", level: "error" },
        { emit: "stdout", level: "warn" },
    ],
    omit: {
        user: {
            accessToken: true,
            refreshToken: true,
            ipAddress: true,
        },
    },
})

export default prisma
