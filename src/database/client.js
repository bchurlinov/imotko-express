import { PrismaClient } from "#generated/prisma/client.ts"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
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
