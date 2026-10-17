import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { startAgencyInquiry } from "./conversation.service.js"

const originals = {
    userFindUnique: prisma.user.findUnique,
    agencyFindUnique: prisma.agency.findUnique,
    propertyFindFirst: prisma.property.findFirst,
    conversationFindUnique: prisma.conversation.findUnique,
    participantCount: prisma.conversationParticipant.count,
    participantFindUnique: prisma.conversationParticipant.findUnique,
    messageFindUnique: prisma.message.findUnique,
    messageFindMany: prisma.message.findMany,
    transaction: prisma.$transaction,
}
afterEach(() => {
    prisma.user.findUnique = originals.userFindUnique
    prisma.agency.findUnique = originals.agencyFindUnique
    prisma.property.findFirst = originals.propertyFindFirst
    prisma.conversation.findUnique = originals.conversationFindUnique
    prisma.conversationParticipant.count = originals.participantCount
    prisma.conversationParticipant.findUnique = originals.participantFindUnique
    prisma.message.findUnique = originals.messageFindUnique
    prisma.message.findMany = originals.messageFindMany
    prisma.$transaction = originals.transaction
})

const ownerWithoutName = {
    id: "u1",
    role: "CLIENT",
    name: "",
    lastName: null,
    email: "ana@x.mk",
    emailVerified: null,
    messagingFlagged: false,
    messagingUnflaggedAt: null,
}

test("agency inquiry displayName falls back to email local part", async () => {
    let participantsCreated
    prisma.user.findUnique = async () => ownerWithoutName
    prisma.agency.findUnique = async () => ({ id: "a1", name: "Agency Dom", status: "APPROVED" })
    prisma.property.findFirst = async () => null
    prisma.conversation.findUnique = async () => null
    prisma.conversationParticipant.count = async () => 0
    prisma.message.findMany = async () => []
    // Held message (unverified sender): no email or push queues start.
    prisma.$transaction = async fn =>
        fn({
            conversation: {
                create: async ({ data }) => {
                    participantsCreated = data.participants.create
                    return {
                        id: "c1",
                        participants: [
                            { id: "pb", userId: "u1" },
                            { id: "pa", userId: null },
                        ],
                    }
                },
            },
            message: { create: async () => ({ id: "m1" }) },
        })

    await startAgencyInquiry({ userId: "u1", agencyId: "a1", bodyHtml: "<p>Здраво</p>" })

    assert.equal(participantsCreated[0].displayName, "ana")
})
