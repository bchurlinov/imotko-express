import { AgencyMemberStatus, UserRole } from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"
import { CHAT_ERRORS } from "./chat_constants.js"
import { ChatError } from "./chat_error.js"
import { releasePendingForUser } from "./chat_lifecycle.service.js"

const profileName = authUser => {
    const metadata = authUser?.user_metadata
    const candidate = metadata && typeof metadata === "object" ? metadata.full_name || metadata.name : null
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 120)
    return (
        String(authUser?.email || "User")
            .split("@")[0]
            .slice(0, 120) || "User"
    )
}

const confirmationDate = authUser => {
    const value = authUser?.email_confirmed_at || authUser?.confirmed_at
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? new Date() : date
}

const viewerForUser = async user => {
    if (user.role === UserRole.CLIENT) return { type: "client", userId: user.id }
    if (user.role === UserRole.ADMIN) return { type: "admin", userId: user.id }
    if (user.role !== UserRole.AGENCY) throw new ChatError(CHAT_ERRORS.FORBIDDEN, 403)

    const membership = await prisma.agencyMember.findFirst({
        where: { userId: user.id, status: AgencyMemberStatus.active, agencyId: { not: null } },
        select: { id: true, role: true, agencyId: true },
    })
    if (!membership) throw new ChatError(CHAT_ERRORS.FORBIDDEN, 403)
    return {
        type: "agency",
        userId: user.id,
        agencyId: membership.agencyId,
        memberId: membership.id,
        role: membership.role,
    }
}

export const resolveChatIdentity = async authUser => {
    if (!authUser?.id) throw new ChatError(CHAT_ERRORS.UNAUTHORIZED, 401)

    const normalizedEmail = typeof authUser.email === "string" ? authUser.email.trim().toLowerCase() : ""
    const confirmedAt = confirmationDate(authUser)
    let becameVerified = false

    const user = await prisma.$transaction(async tx => {
        let current = await tx.user.findUnique({ where: { supabaseUserId: authUser.id } })

        if (!current && normalizedEmail && confirmedAt) {
            const emailMatch = await tx.user.findUnique({ where: { email: normalizedEmail } })
            if (emailMatch?.supabaseUserId && emailMatch.supabaseUserId !== authUser.id) {
                throw new ChatError(CHAT_ERRORS.FORBIDDEN, 403)
            }
            if (emailMatch) {
                await tx.user.updateMany({
                    where: { id: emailMatch.id, supabaseUserId: null },
                    data: { supabaseUserId: authUser.id },
                })
                current = await tx.user.findUnique({ where: { id: emailMatch.id } })
                if (current?.supabaseUserId !== authUser.id) throw new ChatError(CHAT_ERRORS.FORBIDDEN, 403)
            }
        }

        if (!current) {
            if (!normalizedEmail) throw new ChatError(CHAT_ERRORS.UNAUTHORIZED, 401)
            current = await tx.user.create({
                data: {
                    supabaseUserId: authUser.id,
                    email: normalizedEmail,
                    name: profileName(authUser),
                    emailVerified: confirmedAt,
                    role: UserRole.CLIENT,
                    client: { create: {} },
                },
                include: { client: true },
            })
            if (current.client && !current.clientId) {
                current = await tx.user.update({ where: { id: current.id }, data: { clientId: current.client.id } })
            }
        } else if (confirmedAt && !current.emailVerified) {
            const updated = await tx.user.updateMany({
                where: { id: current.id, emailVerified: null },
                data: { emailVerified: confirmedAt },
            })
            becameVerified = updated.count === 1
            current = await tx.user.findUnique({ where: { id: current.id } })
        }

        return current
    })

    if (becameVerified) await releasePendingForUser(user.id)
    return { user, viewer: await viewerForUser(user) }
}
