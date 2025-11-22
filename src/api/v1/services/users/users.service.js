import createError from "http-errors"
import prisma from "#database/client.js"
import { supabaseAdmin } from "#utils/supabaseClient.js"
import { UserLanguage, UserRole } from "#generated/prisma"

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
 * Build default avatar URL
 * @returns {string | undefined}
 */
const buildDefaultAvatar = () => {
    if (!process.env.AWS_S3_URL) return undefined
    return `${process.env.AWS_S3_URL}/user_avatar.svg`
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
