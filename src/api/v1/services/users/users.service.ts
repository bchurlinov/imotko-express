import createError from "http-errors"
import prisma from "@/database/client.js"
import { supabaseAdmin } from "@/utils/supabaseClient.js"
import type { Prisma } from "@generated/prisma"
import { UserLanguage, UserRole } from "@/generated/prisma/index.js"

type UserLanguageValue = (typeof UserLanguage)[keyof typeof UserLanguage]
type UserRoleValue = (typeof UserRole)[keyof typeof UserRole]

export interface CreateUserInput {
    email: string
    password: string
    name: string
    lastName?: string
    phone?: string
    location?: string
    language?: UserLanguageValue
    role?: UserRoleValue
    metadata?: Record<string, unknown>
}

type UserEntity = Prisma.UserGetPayload<{}>

const isEnumValue = <T extends Record<string, string>>(enumObject: T, value?: string): value is T[keyof T] =>
    typeof value === "string" && Object.values(enumObject).includes(value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const removeUndefined = (input: Record<string, unknown>): Record<string, unknown> =>
    Object.entries(input).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (value !== undefined) acc[key] = value
        return acc
    }, {})

const buildDefaultAvatar = (): string | undefined => {
    if (!process.env.AWS_S3_URL) return undefined
    return `${process.env.AWS_S3_URL}/user_avatar.svg`
}

export const createUserService = async ({
    email,
    password,
    name,
    lastName,
    phone,
    location,
    language,
    role,
    metadata,
}: CreateUserInput): Promise<{ user: UserEntity }> => {
    if (!email || !password || !name) throw createError(400, "Email, password, and name are required")

    const normalizedEmail = email.toLowerCase()
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existingUser) throw createError(409, "User with this email already exists")

    const resolvedLanguage = isEnumValue(UserLanguage, language) ? language : undefined
    const resolvedRole = isEnumValue(UserRole, role) ? role : UserRole.CLIENT

    const supabaseMetadataSource = {
        name,
        lastName,
        phone,
        location,
        language: resolvedLanguage,
        role: resolvedRole,
        ...(isRecord(metadata) ? metadata : {}),
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: removeUndefined(supabaseMetadataSource),
        app_metadata: { role: resolvedRole },
    })

    if (error || !data?.user) {
        const statusCode = typeof error?.status === "number" ? error.status : 502
        if (statusCode === 422) throw createError(409, "Supabase user already exists")

        throw createError(statusCode, error?.message ?? "Failed to create Supabase user")
    }

    const supabaseUser = data.user

    try {
        const user = await prisma.$transaction(
            async (tx: {
                user: {
                    create: (arg0: { data: Prisma.UserCreateInput }) => any
                    update: (arg0: { where: { id: any }; data: { clientId: any } }) => any
                }
                client: { create: (arg0: { data: { user: { connect: { id: any } } } }) => any }
            }) => {
                const userData: Prisma.UserCreateInput = {
                    id: supabaseUser.id,
                    email: normalizedEmail,
                    name,
                    role: resolvedRole,
                }

                if (lastName) userData.lastName = lastName
                if (phone) userData.phone = phone
                if (location) userData.location = location
                if (resolvedLanguage) userData.language = resolvedLanguage
                const avatar = buildDefaultAvatar()
                if (avatar) userData.image = avatar
                if (supabaseUser.email_confirmed_at) {
                    userData.emailVerified = new Date(supabaseUser.email_confirmed_at)
                }

                const createdUser = await tx.user.create({ data: userData })

                if (resolvedRole !== UserRole.CLIENT) {
                    return createdUser
                }

                const client = await tx.client.create({
                    data: {
                        user: {
                            connect: { id: createdUser.id },
                        },
                    },
                })

                return tx.user.update({
                    where: { id: createdUser.id },
                    data: { clientId: client.id },
                })
            }
        )

        return { user }
    } catch (dbError) {
        try {
            await supabaseAdmin.auth.admin.deleteUser(supabaseUser.id)
        } catch (cleanupError) {
            console.error("[Supabase] Failed to roll back user:", cleanupError)
        }

        throw dbError
    }
}
