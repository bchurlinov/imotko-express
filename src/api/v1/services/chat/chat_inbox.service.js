import { AgencyApprovalStatus, MessageKind, MessageStatus, PropertyStatus } from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"
import { escapeHtml, fullName, isoOrNull, pickLocalized } from "./chat_format.js"
import { buildPropertySnapshot, findViewerParticipant } from "./conversation.service.js"
import { canRemoveConversation, inboxParticipantWhere, visibleMessageWhere } from "./chat_policy.js"
import { CHAT_PERMISSION, hasChatPermission } from "./chat_permissions.js"
import { chatSystemEventText } from "./chat_locales.js"

const THREAD_MESSAGE_LIMIT = 200
export const INBOX_PAGE_SIZE = 30

const isPersonSide = participant => Boolean(participant.userId || participant.deletedAt)
const agencyLogo = participant => participant?.agency?.logo?.sizes?.small || null
const messagePreview = (message, locale) =>
    (message?.kind === MessageKind.SYSTEM ? chatSystemEventText(locale, message.bodyText) : message?.bodyText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 140)
const inboxItem = (row, locale) => {
    const counterpart = row.conversation.participants.find(participant => participant.id !== row.id)
    const agency = row.conversation.participants.find(participant => participant.agencyId)
    const last = row.conversation.messages[0]
    const preview = last ? messagePreview(last, locale) : null
    const property = row.conversation.propertySnapshot
        ? {
              id: row.conversation.propertyId,
              title: pickLocalized(row.conversation.propertySnapshot.name, locale),
              thumbnailUrl: row.conversation.propertySnapshot.photo || null,
          }
        : null
    return {
        id: row.conversation.id,
        kind: row.conversation.kind,
        counterpartName: counterpart?.displayName || "",
        counterpartDeleted: Boolean(counterpart?.deletedAt),
        counterpartLogo: agencyLogo(counterpart),
        preview: last ? (last.kind === MessageKind.SYSTEM ? { systemEvent: last.bodyText } : { text: preview }) : null,
        lastAt: (last?.createdAt || row.conversation.createdAt).toISOString(),
        unreadCount: row.unreadCount,
        propertyTitle: pickLocalized(row.conversation.propertySnapshot?.name, locale),
        closed: Boolean(row.conversation.closedAt),
        blocked: row.conversation.participants.some(participant => participant.blockedAt),
        agency: agency ? { id: agency.agencyId, name: agency.displayName, logoUrl: agencyLogo(agency) } : null,
        counterpart: counterpart
            ? {
                  id: counterpart.agencyId || counterpart.userId,
                  name: counterpart.displayName,
                  logoUrl: agencyLogo(counterpart),
              }
            : null,
        property,
        lastMessage: last
            ? { preview, createdAt: last.createdAt.toISOString(), isMine: last.senderParticipantId === row.id }
            : null,
    }
}

export const getInbox = async (viewer, { search = "", locale = "mk", limit = INBOX_PAGE_SIZE } = {}) => {
    if (viewer?.type !== "client" && viewer?.type !== "agency") return { items: [], hasMore: false }
    const query = search.trim()
    const scope = inboxParticipantWhere(viewer)
    const counterpart = viewer.type === "agency" ? { agencyId: null } : { agencyId: { not: null } }
    const where = query
        ? {
              ...scope,
              conversation: {
                  ...scope.conversation,
                  OR: [
                      {
                          participants: {
                              some: { ...counterpart, displayName: { contains: query, mode: "insensitive" } },
                          },
                      },
                      ...[...new Set([locale, "mk", "en"])].map(language => ({
                          propertySnapshot: { path: ["name", language], string_contains: query, mode: "insensitive" },
                      })),
                  ],
              },
          }
        : scope
    const cappedLimit = Math.max(1, Math.min(INBOX_PAGE_SIZE * 10, Number(limit) || INBOX_PAGE_SIZE))
    const rows = await prisma.conversationParticipant.findMany({
        where,
        orderBy: [{ conversation: { updatedAt: "desc" } }, { id: "desc" }],
        take: cappedLimit + 1,
        select: {
            id: true,
            unreadCount: true,
            conversation: {
                select: {
                    id: true,
                    kind: true,
                    propertyId: true,
                    createdAt: true,
                    closedAt: true,
                    propertySnapshot: true,
                    participants: {
                        select: {
                            id: true,
                            userId: true,
                            agencyId: true,
                            displayName: true,
                            deletedAt: true,
                            blockedAt: true,
                            agency: { select: { logo: true } },
                        },
                    },
                    messages: {
                        where: visibleMessageWhere({ viewerType: viewer.type, viewerUserId: viewer.userId }),
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        select: { kind: true, bodyText: true, createdAt: true, senderParticipantId: true },
                    },
                },
            },
        },
    })
    return { items: rows.slice(0, cappedLimit).map(row => inboxItem(row, locale)), hasMore: rows.length > cappedLimit }
}

const shapeProperty = (conversation, locale, viewer) => {
    const live = conversation.property
    if (!live && !conversation.propertySnapshot) return null
    const available = Boolean(live && live.status === PropertyStatus.PUBLISHED)
    const source = live ? buildPropertySnapshot(live) : conversation.propertySnapshot
    return {
        title: pickLocalized(source.name, locale),
        photo: source.photo || conversation.propertySnapshot?.photo || null,
        id: live?.id || conversation.propertyId || null,
        price: source.price ?? null,
        thumbnailUrl: source.photo || conversation.propertySnapshot?.photo || null,
        listingType: source.listingType || null,
        size: source.size || null,
        rooms: source.rooms || null,
        bathrooms: source.bathrooms || null,
        location: source.location || null,
        agentName: live?.createdByMember?.user ? fullName(live.createdByMember.user) : null,
        internalId: viewer.type === "client" ? null : live?.externalId || null,
        href: available ? `/${locale}/nedviznini/${live.slug}/${live.id}` : null,
        available,
    }
}

const senderLabel = (message, participants) => {
    const participant = participants.find(item => item.id === message.senderParticipantId)
    if (!participant) return null
    if (isPersonSide(participant)) return participant.displayName
    const member = message.senderUser ? fullName(message.senderUser) : ""
    return member ? `${member} · ${participant.displayName}` : participant.displayName
}

const readSide = participant =>
    participant ? { lastReadAt: isoOrNull(participant.lastReadAt), unreadCount: participant.unreadCount || 0 } : null

const isSeen = (message, participants) => {
    if (message.kind !== MessageKind.USER || message.status !== MessageStatus.DELIVERED || !message.deliveredAt)
        return false
    const recipient = participants.find(item => item.id !== message.senderParticipantId)
    return Boolean(recipient?.lastReadAt && new Date(message.deliveredAt) <= new Date(recipient.lastReadAt))
}

const inboxHrefFor = (viewer, locale) =>
    viewer.type === "admin"
        ? null
        : `/${locale}${viewer.type === "client" ? "/korisnicka-smetka/poraki" : "/smetka/agencija/prodazba/poraki"}`

export const shapeThread = ({ conversation, viewer, locale }) => {
    const own = findViewerParticipant(conversation.participants, viewer)
    const personSide = conversation.participants.find(isPersonSide) || null
    const agencySide = conversation.participants.find(participant => !isPersonSide(participant)) || null
    const counterpart = viewer.type === "client" ? agencySide : personSide
    const agencyInactive = !agencySide?.agencyId || agencySide.agency?.status === AgencyApprovalStatus.DELETED
    const blocked = conversation.participants.some(participant => participant.blockedAt)
    const blockedByOther = conversation.participants.some(
        participant => participant.id !== own?.id && participant.blockedAt
    )
    const messagingFlagged = viewer.type === "client" && Boolean(own?.user?.messagingFlagged)
    const canWrite =
        viewer.type === "client" || (viewer.type === "agency" && hasChatPermission(viewer.role, CHAT_PERMISSION.WRITE))
    return {
        id: conversation.id,
        kind: conversation.kind,
        readOnly: viewer.type === "admin",
        closed: Boolean(conversation.closedAt),
        blocked,
        blockedByMe: Boolean(own?.blockedAt),
        blockedByOther,
        blockedState: { byMe: Boolean(own?.blockedAt), byOther: blockedByOther },
        blockedBy: personSide?.blockedAt ? "client" : agencySide?.blockedAt ? "agency" : null,
        hasUnread: (own?.unreadCount || 0) > 0,
        canReply:
            canWrite &&
            !conversation.closedAt &&
            !blocked &&
            !messagingFlagged &&
            !(viewer.type === "client" && agencyInactive),
        replyRestricted: viewer.type === "agency" && !canWrite,
        canRemove: canRemoveConversation(viewer),
        inboxHref: inboxHrefFor(viewer, locale),
        readStatus:
            viewer.type === "admin"
                ? {
                      agency: agencySide
                          ? { ...readSide(agencySide), readByName: agencySide.lastReadByMember?.user?.name || null }
                          : null,
                      client: readSide(personSide),
                  }
                : null,
        counterpart: {
            id: counterpart?.agencyId || counterpart?.userId || null,
            name: counterpart?.displayName || "",
            logo: agencyLogo(counterpart),
            logoUrl: agencyLogo(counterpart),
            deleted: Boolean(counterpart?.deletedAt),
            agencyInactive: viewer.type === "client" ? agencyInactive : false,
            phone: viewer.type === "client" ? null : counterpart?.user?.phone || null,
            ...(viewer.type === "agency"
                ? {
                      email: counterpart?.user?.email || null,
                      memberSince: isoOrNull(counterpart?.user?.createdAt),
                      emailVerified: Boolean(counterpart?.user?.emailVerified),
                  }
                : {}),
        },
        agencyName: agencySide?.displayName || null,
        conversation: {
            id: conversation.id,
            agencyId: agencySide?.agencyId || null,
            propertyId: conversation.propertyId || null,
            closedAt: isoOrNull(conversation.closedAt),
        },
        readByName: viewer.type === "agency" ? own?.lastReadByMember?.user?.name || null : null,
        property: shapeProperty(conversation, locale, viewer),
        messages: [...conversation.messages].reverse().map(message => ({
            id: message.id,
            kind: message.kind,
            bodyHtml:
                message.kind === MessageKind.SYSTEM
                    ? `<p>${escapeHtml(chatSystemEventText(locale, message.bodyText))}</p>`
                    : message.bodyHtml,
            bodyText: message.bodyText,
            createdAt: new Date(message.createdAt).toISOString(),
            mine: Boolean(own && message.senderParticipantId === own.id),
            isMine: Boolean(own && message.senderParticipantId === own.id),
            senderName: message.kind === MessageKind.SYSTEM ? null : senderLabel(message, conversation.participants),
            ...(viewer.type === "admin" || (own && message.senderParticipantId === own.id)
                ? { status: message.status, seen: isSeen(message, conversation.participants) }
                : {}),
        })),
    }
}

export const getThread = async (viewer, conversationId, locale = "mk") => {
    if (!viewer || !conversationId) return null
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
            id: true,
            kind: true,
            propertyId: true,
            closedAt: true,
            lastDeliveredAt: true,
            propertySnapshot: true,
            property: {
                select: {
                    id: true,
                    slug: true,
                    status: true,
                    name: true,
                    price: true,
                    listingType: true,
                    size: true,
                    attributes: true,
                    photos: true,
                    district: true,
                    country: true,
                    propertyLocation: { select: { name: true } },
                    externalId: true,
                    createdByMember: { select: { user: { select: { name: true, lastName: true } } } },
                },
            },
            participants: {
                select: {
                    id: true,
                    userId: true,
                    agencyId: true,
                    displayName: true,
                    blockedAt: true,
                    deletedAt: true,
                    removed: true,
                    unreadCount: true,
                    lastReadAt: true,
                    user: {
                        select: {
                            phone: true,
                            email: true,
                            createdAt: true,
                            emailVerified: true,
                            messagingFlagged: true,
                        },
                    },
                    agency: { select: { status: true, logo: true } },
                    lastReadByMember: { select: { user: { select: { name: true } } } },
                },
            },
            messages: {
                where: visibleMessageWhere({ viewerType: viewer.type, viewerUserId: viewer.userId }),
                orderBy: { createdAt: "desc" },
                take: THREAD_MESSAGE_LIMIT,
                select: {
                    id: true,
                    kind: true,
                    bodyHtml: true,
                    bodyText: true,
                    status: true,
                    createdAt: true,
                    deliveredAt: true,
                    senderParticipantId: true,
                    senderUser: { select: { name: true, lastName: true } },
                },
            },
        },
    })
    if (!conversation) return null
    if (viewer.type !== "admin") {
        const own = findViewerParticipant(conversation.participants, viewer)
        if (!own || own.removed) return null
    }
    if (viewer.type === "agency" && !conversation.lastDeliveredAt) return null
    const thread = shapeThread({ conversation, viewer, locale })
    if (viewer.type !== "agency") return thread
    const clientUser = conversation.participants.find(participant => participant.userId)?.user || null
    return { ...thread, crmClient: await findCrmClient(viewer, clientUser, locale) }
}

const findCrmClient = async (viewer, user, locale) => {
    const email = user?.email?.trim()
    const phone = user?.phone?.trim()
    if (!email && !phone) return null
    const match = await prisma.agencyClient.findFirst({
        where: {
            agencyId: viewer.agencyId,
            OR: [...(email ? [{ email: { equals: email, mode: "insensitive" } }] : []), ...(phone ? [{ phone }] : [])],
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, lastName: true, status: true },
    })
    if (!match) return null
    return {
        id: match.id,
        name: fullName(match),
        status: match.status || null,
        href: hasChatPermission(viewer.role, CHAT_PERMISSION.VIEW_CRM)
            ? `/${locale}/smetka/agencija/administracija/klienti/${match.id}`
            : null,
    }
}

export const getUnreadConversationCount = async viewer => {
    if (viewer?.type !== "client" && viewer?.type !== "agency") return 0
    return prisma.conversationParticipant.count({
        where: { ...inboxParticipantWhere(viewer), unreadCount: { gt: 0 } },
    })
}

export const getChatContext = async viewer => {
    if (viewer?.type === "client") {
        const user = await prisma.user.findUnique({
            where: { id: viewer.userId },
            select: { emailVerified: true, messagingFlagged: true },
        })
        return { emailVerified: Boolean(user?.emailVerified), messagingFlagged: Boolean(user?.messagingFlagged) }
    }
    if (viewer?.type !== "agency") return null
    const agency = await prisma.agency.findUnique({
        where: { id: viewer.agencyId },
        select: { ownerId: true, emailNotificationsEnabled: true },
    })
    return {
        emailNotificationsEnabled: Boolean(agency?.emailNotificationsEnabled),
        canManageEmailNotifications:
            Boolean(agency?.ownerId === viewer.userId) || hasChatPermission(viewer.role, CHAT_PERMISSION.MANAGE_EMAIL),
    }
}
