import createError from "http-errors"
import prisma from "#database/client.js"
import { supabaseAdmin } from "#utils/supabaseClient.js"
import { UserLanguage, UserRole } from "@prisma/client"

/**
 * @typedef {Object} CreateUserInput
 * @property {string} email - User email
 * @property {string} password - User password
 * @property {string} name - User first name
 * @property {string} [lastName] - User last name
 * @property {string} [phone] - User phone number
 * @property {string} [location] - User location
 * @property {string} [language] - User language preference
 * @property {string} [role] - User role
 * @property {Record<string, unknown>} [metadata] - Additional metadata
 */

/**
 * Check if value is a valid enum value
 * @template {Record<string, string>} T
 * @param {T} enumObject - Enum object
 * @param {string} [value] - Value to check
 * @returns {boolean}
 */
const isEnumValue = (enumObject, value) => typeof value === "string" && Object.values(enumObject).includes(value)

/**
 * Check if value is a record (plain object)
 * @param {unknown} value - Value to check
 * @returns {boolean}
 */
const isRecord = value => typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * Remove undefined values from object
 * @param {Record<string, unknown>} input - Input object
 * @returns {Record<string, unknown>}
 */
const removeUndefined = input =>
    Object.entries(input).reduce((acc, [key, value]) => {
        if (value !== undefined) acc[key] = value
        return acc
    }, {})

/**
 * @typedef {Object} SupabaseUserData
 * @property {string} id - Supabase user ID
 * @property {string} email - User email
 * @property {string} [email_confirmed_at] - Email confirmation timestamp
 * @property {Object} user_metadata - User metadata from Supabase
 * @property {string} [user_metadata.full_name] - Full name
 * @property {string} [user_metadata.name] - First name
 * @property {string} [user_metadata.avatar_url] - Avatar URL
 * @property {string} [user_metadata.picture] - Picture URL (Google)
 * @property {Object} [app_metadata] - App metadata
 * @property {string} [app_metadata.provider] - Auth provider
 */

/**
 * Find existing user or create new user from Supabase authentication data
 * @param {SupabaseUserData} supabaseUser - Supabase user object from auth response
 * @returns {Promise<{user: object}>}
 */
export const findOrCreateUserService = async supabaseUser => {
    if (!supabaseUser?.email) throw createError(400, "Invalid Supabase user data")
    const normalizedEmail = supabaseUser.email.toLowerCase()

    let existingUser = await prisma.user.findFirst({
        where: {
            OR: [{ email: normalizedEmail }, { id: supabaseUser.id }],
        },
        include: {
            client: true,
            agency: true,
            admin: true,
        },
    })

    if (existingUser) return { user: existingUser }

    const name = supabaseUser.fullName || ""
    const avatarUrl = supabaseUser.avatarUrl || ""

    const role = UserRole.CLIENT

    try {
        const user = await prisma.$transaction(async tx => {
            const userData = {
                email: normalizedEmail,
                name,
                role,
            }

            if (avatarUrl) userData.image = avatarUrl
            if (supabaseUser.email_confirmed_at) userData.emailVerified = new Date()

            const createdUser = await tx.user.create({ data: userData })

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
                include: {
                    client: true,
                },
            })
        })

        return { user }
    } catch (dbError) {
        console.error("[Prisma] Failed to create user:", dbError)
        throw createError(500, "Failed to create user in database")
    }
}

/**
 * Create a new user in both Supabase and Prisma database
 * @param {CreateUserInput} input - User creation input
 * @returns {Promise<{user: object}>}
 */
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
}) => {
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
        const user = await prisma.$transaction(async tx => {
            const userData = {
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
        })

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
