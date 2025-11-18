import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({
    omit: {
        user: {
            refreshToken: true,
            accessToken: true,
            ipAddress: true,
        },
    },
})
export default prisma
