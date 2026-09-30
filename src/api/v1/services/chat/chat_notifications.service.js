import { AgencyMemberStatus } from "#generated/prisma/enums.ts"
import { chatLocaleText } from "./chat_locales.js"
import { userLanguageToLocale } from "./chat_policy.js"

const clientMessagesPath = "/korisnicka-smetka/poraki"
const agencyMessagesPath = "/smetka/agencija/prodazba/poraki"

export const conversationLink = (side, locale, conversationId) =>
    `/${locale}${side === "client" ? clientMessagesPath : agencyMessagesPath}/${conversationId}`

export const resolveParticipantRecipient = async (tx, participant) => {
    if (participant?.userId) {
        const user = await tx.user.findUnique({
            where: { id: participant.userId },
            select: { id: true, email: true, name: true, language: true },
        })
        return user ? { ...user, side: "client" } : null
    }
    if (!participant?.agencyId) return null

    if (participant.assignedMemberId) {
        const member = await tx.agencyMember.findUnique({
            where: { id: participant.assignedMemberId },
            select: {
                status: true,
                agencyId: true,
                user: { select: { id: true, email: true, name: true, language: true } },
            },
        })
        if (member?.status === AgencyMemberStatus.active && member.agencyId === participant.agencyId && member.user) {
            return { ...member.user, side: "agency" }
        }
    }

    const agency = await tx.agency.findUnique({
        where: { id: participant.agencyId },
        select: { agencyOwner: { select: { id: true, email: true, name: true, language: true } } },
    })
    return agency?.agencyOwner ? { ...agency.agencyOwner, side: "agency" } : null
}

export const notifyParticipant = async (tx, { participant, conversationId, type = "new", variables = {} }) => {
    const recipient = await resolveParticipantRecipient(tx, participant)
    if (!recipient) return null
    const locale = userLanguageToLocale(recipient.language)
    const keys = {
        new: ["newTitle", "newDescription"],
        restricted: ["restrictedTitle", "restrictedDescription"],
        restored: ["restoredTitle", "restoredDescription"],
        deleted: ["deletedTitle", "deletedDescription"],
    }
    const [titleKey, descriptionKey] = keys[type] || keys.new
    return tx.notification.create({
        data: {
            recipientId: recipient.id,
            title: chatLocaleText(locale, titleKey, variables),
            description: chatLocaleText(locale, descriptionKey, variables),
            metadata: { link: conversationLink(recipient.side, locale, conversationId), conversationId },
        },
    })
}

export const notifyUser = async (tx, { userId, type, link = null }) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { language: true } })
    if (!user) return null
    const locale = userLanguageToLocale(user.language)
    const keys =
        type === "restored" ? ["restoredTitle", "restoredDescription"] : ["restrictedTitle", "restrictedDescription"]
    return tx.notification.create({
        data: {
            recipientId: userId,
            title: chatLocaleText(locale, keys[0]),
            description: chatLocaleText(locale, keys[1]),
            ...(link ? { metadata: { link: `/${locale}${link}` } } : {}),
        },
    })
}
