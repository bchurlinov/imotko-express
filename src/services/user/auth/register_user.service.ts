import { UserRole } from "@prisma/client"
import createError from "http-errors"
import prisma from "#prisma/prisma"
import bcrypt from "bcryptjs"

// TODO Add S3 URL when creating a new account
export const registerUserService = async (body: any) => {
    const { email, password, name, language, location, ipAddress } = body
    if (!name || !password || !email) throw createError(401, "Name, email and password are required.")

    const existingUser = await prisma.user.findUnique({
        where: { email },
    })

    if (existingUser) throw createError(409, "userEmailExist")
    const hashedPassword = await bcrypt.hash(password, 10)

    return prisma.$transaction(async tx => {
        const user = await tx.user.create({
            data: {
                email,
                name,
                hashedPassword,
                image: `${process.env.AWS_S3_URL}/user_avatar.svg`,
                language,
                location,
                ipAddress,
                role: UserRole.CLIENT,
            },
        })
        const client = await tx.client.upsert({
            where: {
                userId: user.id,
            },
            update: {},
            create: {
                user: {
                    connect: {
                        id: user.id,
                    },
                },
            },
            include: {
                user: true,
            },
        })
        await tx.user.update({
            where: {
                id: user.id,
            },
            data: {
                clientId: client.id,
            },
        })
        return user
    })
}
