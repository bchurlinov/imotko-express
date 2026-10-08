import {
    AgencyApprovalStatus,
    ConversationKind,
    MessageKind,
    MessageStatus,
    PropertyStatus,
    UserRole,
} from "#generated/prisma/enums.ts"
import prisma from "#database/client.js"
import { isHiddenAgency } from "#config/hiddenAgencies.config.js"
import { LEGACY_CAPABILITIES } from "#config/client_capabilities.js"
import { hiddenPropertyConditions } from "#services/properties/utils/visibility.js"
import { CHAT_ERRORS, CHAT_LIMITS, DAY_MS } from "./chat_constants.js"
import { ChatError } from "./chat_error.js"
import { fullName } from "./chat_format.js"
import { queueChatNewMessageEmail } from "./chat_email.service.js"
import { queueChatPushNotification } from "./chat_push.service.js"
import { deliverMessage } from "./message_delivery.service.js"
import { enforceUnansweredLimit } from "./messaging_flag.service.js"
import { buildDedupeKey, canStartAgencyInquiry, resolveInitialStatus } from "./chat_policy.js"
import { CHAT_PERMISSION, hasChatPermission } from "./chat_permissions.js"
import { sanitizeMessage } from "./chat_sanitizer.js"
import { isConversationKindVisible } from "./chat_visibility.js"
import { buildPrivateDedupeKey } from "#shared/chat/private_dedupe_key.js"
import { PRIVATE_PARTICIPANT_FALLBACK } from "#shared/chat/private_participant_fallback.js"
import { shortDisplayName } from "#shared/property_rules/seller_name.js"

const PRISMA_UNIQUE_CONSTRAINT = "P2002"

export const findViewerParticipant = (participants = [], viewer) => {
    if (viewer?.type === "client") return participants.find(participant => participant.userId === viewer.userId) || null
    if (viewer?.type === "agency")
        return participants.find(participant => participant.agencyId === viewer.agencyId) || null
    return null
}

const requireSanitized = bodyHtml => {
    const result = sanitizeMessage(bodyHtml)
    if (result.error) throw new ChatError(result.error, 400)
    return result
}

const loadSender = async userId => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            role: true,
            name: true,
            lastName: true,
            emailVerified: true,
            messagingFlagged: true,
            messagingUnflaggedAt: true,
        },
    })
    if (!user) throw new ChatError(CHAT_ERRORS.FORBIDDEN, 403)
    if (user.messagingFlagged) throw new ChatError(CHAT_ERRORS.MESSAGING_RESTRICTED, 403)
    return user
}

const assertAgencyWriter = viewer => {
    if (viewer.type === "agency" && !hasChatPermission(viewer.role, CHAT_PERMISSION.WRITE)) {
        throw new ChatError(CHAT_ERRORS.FORBIDDEN, 403)
    }
}

const loadViewerParticipant = async (conversationId, viewer, capabilities = LEGACY_CAPABILITIES) => {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
            id: true,
            kind: true,
            closedAt: true,
            participants: true,
        },
    })
    // A thread the caller's app cannot show answers exactly like a missing one.
    const participant =
        conversation && isConversationKindVisible(conversation.kind, capabilities)
            ? findViewerParticipant(conversation.participants, viewer)
            : null
    if (!participant) throw new ChatError(CHAT_ERRORS.NOT_FOUND, 404)
    return { conversation, participant }
}

export const assertAgencyAvailable = async ({ agencyId, propertyId, capabilities = LEGACY_CAPABILITIES }) => {
    const agency =
        agencyId && !isHiddenAgency(agencyId)
            ? await prisma.agency.findUnique({
                  where: { id: agencyId },
                  select: { id: true, name: true, status: true },
              })
            : null
    if (!agency || agency.status !== AgencyApprovalStatus.APPROVED)
        throw new ChatError(CHAT_ERRORS.AGENCY_NOT_AVAILABLE, 404)
    if (!propertyId) return { agency, property: null }

    const property = await prisma.property.findFirst({
        where: {
            id: propertyId,
            agencyId,
            status: PropertyStatus.PUBLISHED,
            // A listing the caller cannot open answers like a missing one.
            AND: hiddenPropertyConditions(capabilities),
        },
        select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            listingType: true,
            size: true,
            attributes: true,
            photos: true,
            district: true,
            country: true,
            propertyLocation: { select: { name: true } },
            createdByMemberId: true,
        },
    })
    if (!property) throw new ChatError(CHAT_ERRORS.AGENCY_NOT_AVAILABLE, 404)
    return { agency, property }
}

export const buildPropertySnapshot = property =>
    property
        ? {
              name: property.name,
              slug: property.slug,
              price: property.price,
              listingType: property.listingType,
              size: property.size,
              rooms: property.attributes?.numOfRooms ?? null,
              bathrooms: property.attributes?.numOfBathrooms ?? null,
              location: property.propertyLocation?.name ?? null,
              district: property.district ?? null,
              country: property.country ?? null,
              photo: property.photos?.[0]?.sizes?.small ?? null,
          }
        : null

export const findAgencyInquiryId = async ({ userId, agencyId, propertyId }) => {
    if (!userId || !agencyId) return null
    const conversation = await prisma.conversation.findUnique({
        where: { dedupeKey: buildDedupeKey({ kind: ConversationKind.AGENCY_INQUIRY, userId, agencyId, propertyId }) },
        select: { id: true },
    })
    return conversation?.id || null
}

const appendMessage = async (
    tx,
    { conversationId, senderParticipantId, senderUserId, sanitized, deliver, requiresAdminReview }
) => {
    const message = await tx.message.create({
        data: {
            conversationId,
            senderParticipantId,
            senderUserId,
            kind: MessageKind.USER,
            bodyHtml: sanitized.bodyHtml,
            bodyText: sanitized.bodyText,
            status: MessageStatus.PENDING_REVIEW,
            requiresAdminReview: Boolean(requiresAdminReview),
        },
    })
    const delivery = deliver ? await deliverMessage(tx, message.id) : null
    return {
        message,
        notifyParticipantId: delivery?.notifyParticipantId || null,
        pushMessageId: delivery?.pushMessageId || null,
    }
}

export const sendMessage = async ({
    conversationId,
    viewer,
    bodyHtml,
    requiresAdminReview = false,
    capabilities = LEGACY_CAPABILITIES,
}) => {
    const sanitized = requireSanitized(bodyHtml)
    const user = await loadSender(viewer.userId)
    assertAgencyWriter(viewer)
    const { conversation, participant } = await loadViewerParticipant(conversationId, viewer, capabilities)
    if (conversation.closedAt) throw new ChatError(CHAT_ERRORS.CONVERSATION_CLOSED, 403)
    if (conversation.participants.some(item => item.blockedAt))
        throw new ChatError(CHAT_ERRORS.CONVERSATION_BLOCKED, 403)
    if (await enforceUnansweredLimit(prisma, user)) throw new ChatError(CHAT_ERRORS.MESSAGING_RESTRICTED, 403)

    const awaitingGuestReview =
        viewer.type === "client" &&
        (await prisma.message.findFirst({
            where: {
                conversationId,
                requiresAdminReview: true,
                status: { in: [MessageStatus.PENDING_REVIEW, MessageStatus.REJECTED] },
            },
            select: { id: true },
        }))
    const holdForReview = requiresAdminReview || Boolean(awaitingGuestReview)
    const deliver =
        !holdForReview &&
        resolveInitialStatus({ senderType: viewer.type, emailVerified: user.emailVerified }) === MessageStatus.DELIVERED
    const result = await prisma.$transaction(tx =>
        appendMessage(tx, {
            conversationId,
            senderParticipantId: participant.id,
            senderUserId: user.id,
            sanitized,
            deliver,
            requiresAdminReview: holdForReview,
        })
    )
    queueChatNewMessageEmail(result.notifyParticipantId)
    queueChatPushNotification(result.pushMessageId)
    return result.message
}

// Threads a seller received about their own listings were not started by them.
const countClientConversations = (userId, since) =>
    prisma.conversationParticipant.count({
        where: { userId, isSeller: false, ...(since ? { createdAt: { gte: since } } : {}) },
    })

// The limits every new conversation started by a client passes (agency inquiries and buyer → seller threads).
const assertCanStartConversation = async (user, now) => {
    if (
        (await countClientConversations(user.id, new Date(now.getTime() - DAY_MS))) >=
        CHAT_LIMITS.NEW_CONVERSATIONS_PER_DAY
    ) {
        throw new ChatError(CHAT_ERRORS.CONVERSATION_DAILY_LIMIT, 429)
    }
    if (!user.emailVerified && (await countClientConversations(user.id)) >= CHAT_LIMITS.UNVERIFIED_CONVERSATIONS) {
        throw new ChatError(CHAT_ERRORS.UNVERIFIED_CONVERSATION_LIMIT, 403)
    }
    if (await enforceUnansweredLimit(prisma, user)) throw new ChatError(CHAT_ERRORS.MESSAGING_RESTRICTED, 403)
}

export const startAgencyInquiry = async ({
    userId,
    agencyId,
    propertyId = null,
    bodyHtml,
    requiresAdminReview = false,
    now = new Date(),
    capabilities = LEGACY_CAPABILITIES,
}) => {
    const sanitized = requireSanitized(bodyHtml)
    const user = await loadSender(userId)
    if (!canStartAgencyInquiry(user)) throw new ChatError(CHAT_ERRORS.FORBIDDEN, 403)
    const { agency, property } = await assertAgencyAvailable({ agencyId, propertyId, capabilities })
    const viewer = { type: "client", userId }
    const dedupeKey = buildDedupeKey({
        kind: ConversationKind.AGENCY_INQUIRY,
        userId,
        agencyId,
        propertyId: property?.id,
    })
    const existing = await prisma.conversation.findUnique({ where: { dedupeKey }, select: { id: true } })
    if (existing) {
        const message = await sendMessage({ conversationId: existing.id, viewer, bodyHtml, requiresAdminReview })
        return { conversationId: existing.id, created: false, messageId: message.id }
    }
    await assertCanStartConversation(user, now)
    const deliver =
        !requiresAdminReview &&
        resolveInitialStatus({ senderType: "client", emailVerified: user.emailVerified }) === MessageStatus.DELIVERED

    try {
        const result = await prisma.$transaction(async tx => {
            const conversation = await tx.conversation.create({
                data: {
                    kind: ConversationKind.AGENCY_INQUIRY,
                    dedupeKey,
                    propertyId: property?.id || null,
                    propertySnapshot: buildPropertySnapshot(property) || undefined,
                    participants: {
                        create: [
                            { userId, displayName: fullName(user) || user.id },
                            {
                                agencyId: agency.id,
                                assignedMemberId: property?.createdByMemberId || null,
                                displayName: agency.name,
                            },
                        ],
                    },
                },
                select: { id: true, participants: { select: { id: true, userId: true } } },
            })
            const senderParticipant = conversation.participants.find(item => item.userId === userId)
            const appended = await appendMessage(tx, {
                conversationId: conversation.id,
                senderParticipantId: senderParticipant.id,
                senderUserId: userId,
                sanitized,
                deliver,
                requiresAdminReview,
            })
            return {
                conversationId: conversation.id,
                messageId: appended.message.id,
                notifyParticipantId: appended.notifyParticipantId,
                pushMessageId: appended.pushMessageId,
            }
        })
        queueChatNewMessageEmail(result.notifyParticipantId)
        queueChatPushNotification(result.pushMessageId)
        return { conversationId: result.conversationId, messageId: result.messageId, created: true }
    } catch (error) {
        if (error?.code !== PRISMA_UNIQUE_CONSTRAINT) throw error
        const raced = await prisma.conversation.findUnique({ where: { dedupeKey }, select: { id: true } })
        if (!raced) throw error
        const message = await sendMessage({ conversationId: raced.id, viewer, bodyHtml, requiresAdminReview })
        return { conversationId: raced.id, messageId: message.id, created: false }
    }
}

const PRIVATE_LISTING_SELECT = {
    id: true,
    name: true,
    slug: true,
    price: true,
    listingType: true,
    size: true,
    attributes: true,
    photos: true,
    district: true,
    country: true,
    propertyLocation: { select: { name: true } },
    client: { select: { userId: true, user: { select: { name: true, lastName: true } } } },
}

export const assertPrivateListingAvailable = async ({ propertyId, capabilities = LEGACY_CAPABILITIES }) => {
    const property = propertyId
        ? await prisma.property.findFirst({
              where: {
                  id: propertyId,
                  status: PropertyStatus.PUBLISHED,
                  clientId: { not: null },
                  AND: hiddenPropertyConditions(capabilities),
              },
              select: PRIVATE_LISTING_SELECT,
          })
        : null
    if (!property?.client?.userId) throw new ChatError(CHAT_ERRORS.LISTING_NOT_AVAILABLE, 404)
    return property
}

export const findPrivateInquiryId = async ({ userId, propertyId }) => {
    if (!userId || !propertyId) return null
    const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { client: { select: { userId: true } } },
    })
    const sellerUserId = property?.client?.userId
    if (!sellerUserId) return null
    const conversation = await prisma.conversation.findUnique({
        where: { dedupeKey: buildPrivateDedupeKey({ buyerUserId: userId, sellerUserId, propertyId }) },
        select: { id: true },
    })
    return conversation?.id || null
}

// Buyer → private seller (design B §6.5, design D §4.4). Same safety rules as agency inquiries.
export const startPrivateInquiry = async ({
    buyerUserId,
    propertyId,
    bodyHtml,
    requiresAdminReview = false,
    now = new Date(),
    capabilities = LEGACY_CAPABILITIES,
}) => {
    const sanitized = requireSanitized(bodyHtml)
    const buyer = await loadSender(buyerUserId)
    if (!canStartAgencyInquiry(buyer)) throw new ChatError(CHAT_ERRORS.FORBIDDEN, 403)

    const property = await assertPrivateListingAvailable({ propertyId, capabilities })
    const sellerUserId = property.client.userId
    if (sellerUserId === buyerUserId) throw new ChatError(CHAT_ERRORS.CANNOT_MESSAGE_OWN_LISTING, 403)

    const viewer = { type: "client", userId: buyerUserId }
    const dedupeKey = buildPrivateDedupeKey({ buyerUserId, sellerUserId, propertyId: property.id })
    const existing = await prisma.conversation.findUnique({ where: { dedupeKey }, select: { id: true } })
    if (existing) {
        const message = await sendMessage({
            conversationId: existing.id,
            viewer,
            bodyHtml,
            requiresAdminReview,
            capabilities,
        })
        return { conversationId: existing.id, messageId: message.id, created: false }
    }

    await assertCanStartConversation(buyer, now)
    const deliver =
        !requiresAdminReview &&
        resolveInitialStatus({ senderType: "client", emailVerified: buyer.emailVerified }) === MessageStatus.DELIVERED

    try {
        const result = await prisma.$transaction(async tx => {
            const conversation = await tx.conversation.create({
                data: {
                    kind: ConversationKind.PRIVATE_INQUIRY,
                    dedupeKey,
                    propertyId: property.id,
                    propertySnapshot: buildPropertySnapshot(property),
                    participants: {
                        create: [
                            {
                                userId: buyerUserId,
                                displayName: shortDisplayName(buyer) || PRIVATE_PARTICIPANT_FALLBACK.buyer,
                            },
                            {
                                userId: sellerUserId,
                                isSeller: true,
                                displayName:
                                    shortDisplayName(property.client.user) || PRIVATE_PARTICIPANT_FALLBACK.seller,
                            },
                        ],
                    },
                },
                select: { id: true, participants: { select: { id: true, userId: true } } },
            })
            const senderParticipant = conversation.participants.find(item => item.userId === buyerUserId)
            const appended = await appendMessage(tx, {
                conversationId: conversation.id,
                senderParticipantId: senderParticipant.id,
                senderUserId: buyerUserId,
                sanitized,
                deliver,
                requiresAdminReview,
            })
            return {
                conversationId: conversation.id,
                messageId: appended.message.id,
                notifyParticipantId: appended.notifyParticipantId,
                pushMessageId: appended.pushMessageId,
            }
        })
        queueChatNewMessageEmail(result.notifyParticipantId)
        queueChatPushNotification(result.pushMessageId)
        return { conversationId: result.conversationId, messageId: result.messageId, created: true }
    } catch (error) {
        if (error?.code !== PRISMA_UNIQUE_CONSTRAINT) throw error
        const raced = await prisma.conversation.findUnique({ where: { dedupeKey }, select: { id: true } })
        if (!raced) throw error
        const message = await sendMessage({
            conversationId: raced.id,
            viewer,
            bodyHtml,
            requiresAdminReview,
            capabilities,
        })
        return { conversationId: raced.id, messageId: message.id, created: false }
    }
}

export const markRead = async ({ conversationId, viewer, now = new Date(), capabilities = LEGACY_CAPABILITIES }) => {
    const { participant } = await loadViewerParticipant(conversationId, viewer, capabilities)
    return prisma.conversationParticipant.update({
        where: { id: participant.id },
        data: {
            unreadCount: 0,
            firstUnreadAt: null,
            reminderCount: 0,
            lastReadAt: now,
            ...(viewer.type === "agency" ? { lastReadByMemberId: viewer.memberId } : {}),
        },
    })
}

export const toggleBlock = async ({ conversationId, viewer, capabilities = LEGACY_CAPABILITIES }) => {
    assertAgencyWriter(viewer)
    const { conversation, participant } = await loadViewerParticipant(conversationId, viewer, capabilities)
    if (participant.removed) throw new ChatError(CHAT_ERRORS.CONVERSATION_BLOCKED, 409)
    const blockedByOther = conversation.participants.some(item => item.id !== participant.id && item.blockedAt)
    if (!participant.blockedAt && blockedByOther) throw new ChatError(CHAT_ERRORS.CONVERSATION_BLOCKED, 409)
    return prisma.conversationParticipant.update({
        where: { id: participant.id },
        data: { blockedAt: participant.blockedAt ? null : new Date() },
    })
}

export const reportConversation = async ({ conversationId, viewer, reason, capabilities = LEGACY_CAPABILITIES }) => {
    const { participant } = await loadViewerParticipant(conversationId, viewer, capabilities)
    const trimmed = typeof reason === "string" ? reason.trim().slice(0, CHAT_LIMITS.REPORT_REASON_MAX_LENGTH) : ""
    return prisma.conversationReport.create({
        data: { conversationId, reporterParticipantId: participant.id, reason: trimmed || null },
    })
}
