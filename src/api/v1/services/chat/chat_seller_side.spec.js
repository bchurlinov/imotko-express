import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import prisma from "#database/client.js"
import { countRecentUnanswered } from "./messaging_flag.service.js"
import { chatSystemEventText } from "./chat_locales.js"
import { startAgencyInquiry } from "./conversation.service.js"

const originals = {
    count: prisma.conversationParticipant.count,
    user: prisma.user.findUnique,
    agency: prisma.agency.findUnique,
    conversation: prisma.conversation.findUnique,
    messages: prisma.message.findMany,
    transaction: prisma.$transaction,
}
afterEach(() => {
    prisma.conversationParticipant.count = originals.count
    prisma.user.findUnique = originals.user
    prisma.agency.findUnique = originals.agency
    prisma.conversation.findUnique = originals.conversation
    prisma.message.findMany = originals.messages
    prisma.$transaction = originals.transaction
})

// Review Focus 4
test("a seller's replies on the web never count as unanswered", async () => {
    let where
    const db = {
        message: {
            findMany: async args => {
                where = args.where
                return []
            },
        },
    }
    await countRecentUnanswered(db, "u9", new Date())
    assert.deepEqual(where.senderParticipant, { isSeller: false })
})

test("the app gets text for the new system events in every locale", () => {
    for (const locale of ["mk", "en", "sq", "tr"]) {
        assert.notEqual(chatSystemEventText(locale, "accountConverted"), "accountConverted")
        assert.notEqual(chatSystemEventText(locale, "sellerRemovedConversation"), "sellerRemovedConversation")
    }
})

// Review Focus 4
test("conversations a seller received do not use up their daily allowance", async () => {
    const counted = []
    prisma.user.findUnique = async () => ({
        id: "u9",
        role: "CLIENT",
        emailVerified: new Date(),
        messagingFlagged: false,
    })
    prisma.agency.findUnique = async () => ({ id: "a1", name: "Dom", status: "APPROVED" })
    prisma.conversation.findUnique = async () => null
    prisma.message.findMany = async () => [] // unanswered check: nothing sent today
    prisma.conversationParticipant.count = async ({ where }) => {
        counted.push(where)
        return 0
    }
    prisma.$transaction = async () => {
        throw new Error("stop after the limit checks")
    }
    await assert.rejects(() => startAgencyInquiry({ userId: "u9", agencyId: "a1", bodyHtml: "<p>Hi</p>" }), {
        message: "stop after the limit checks",
    })
    assert.ok(counted.length > 0)
    for (const where of counted) assert.equal(where.isSeller, false)
})
