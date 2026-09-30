import { UserRole } from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"
import { supabaseAdmin } from "#utils/supabaseClient.js"
import { CHAT_ERRORS } from "./chat_constants.js"
import { ChatError } from "./chat_error.js"
import { localeToUserLanguage } from "./chat_policy.js"

export const normalizeGuestEmail = value =>
    String(value || "")
        .trim()
        .toLowerCase()

export const createGuestClient = async ({ email, name, phone, locale, ipAddress }) => {
    try {
        return await prisma.$transaction(async tx => {
            const user = await tx.user.create({
                data: {
                    email,
                    name,
                    phone: phone || null,
                    language: localeToUserLanguage(locale),
                    ipAddress: ipAddress || null,
                    role: UserRole.CLIENT,
                },
            })
            const client = await tx.client.create({ data: { userId: user.id } })
            return tx.user.update({ where: { id: user.id }, data: { clientId: client.id } })
        })
    } catch (error) {
        if (error?.code === "P2002") throw new ChatError("accountExists", 409)
        throw error
    }
}

export const deleteGuestClient = async userId => {
    if (!userId) return
    await prisma.user.deleteMany({ where: { id: userId, role: UserRole.CLIENT, emailVerified: null } })
}

export const requestGuestMagicLink = async ({ email, locale }) => {
    const baseUrl = (process.env.IMOTKO_WEB_URL || "https://imotko.mk").replace(/\/$/, "")
    const { error } = await supabaseAdmin.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: true,
            emailRedirectTo: `${baseUrl}/${locale}/korisnicka-smetka/poraki`,
        },
    })
    if (error) throw new ChatError("emailConfirmationError", 400)
}

export const existingGuestOutcome = async ({ email, verificationChoice }) => {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
    if (!existing) return null
    if (existing.role !== UserRole.CLIENT) throw new ChatError(CHAT_ERRORS.USE_AGENCY_ACCOUNT, 409)
    return verificationChoice === "verify"
        ? { message: "codeRequired", data: { codeRequired: true } }
        : { message: "accountExists", data: { existingAccount: true } }
}
