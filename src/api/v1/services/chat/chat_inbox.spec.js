import assert from "node:assert/strict"
import test from "node:test"
import { shapeThread } from "./chat_inbox.service.js"

test("participant threads expose the mobile contract alongside legacy fields", () => {
    const thread = shapeThread({
        viewer: { type: "client", userId: "user_1" },
        locale: "en",
        conversation: {
            id: "conversation_1",
            kind: "AGENCY_INQUIRY",
            propertyId: "property_1",
            closedAt: null,
            property: null,
            propertySnapshot: null,
            participants: [
                {
                    id: "participant_client",
                    userId: "user_1",
                    agencyId: null,
                    displayName: "Client",
                    blockedAt: null,
                    deletedAt: null,
                    unreadCount: 0,
                    lastReadAt: null,
                    user: { messagingFlagged: false },
                    agency: null,
                    lastReadByMember: null,
                },
                {
                    id: "participant_agency",
                    userId: null,
                    agencyId: "agency_1",
                    displayName: "Dom Agency",
                    blockedAt: null,
                    deletedAt: null,
                    unreadCount: 1,
                    lastReadAt: null,
                    user: null,
                    agency: { status: "APPROVED", logo: { sizes: { small: "https://cdn.example/logo.jpg" } } },
                    lastReadByMember: null,
                },
            ],
            messages: [
                {
                    id: "message_1",
                    kind: "USER",
                    bodyHtml: "<p>Hello</p>",
                    bodyText: "Hello",
                    status: "PENDING_REVIEW",
                    createdAt: new Date("2026-09-30T10:00:00.000Z"),
                    deliveredAt: null,
                    senderParticipantId: "participant_client",
                    senderUser: null,
                },
            ],
        },
    })

    assert.deepEqual(thread.conversation, {
        id: "conversation_1",
        agencyId: "agency_1",
        propertyId: "property_1",
        closedAt: null,
    })
    assert.equal(thread.counterpart.id, "agency_1")
    assert.equal(thread.counterpart.logoUrl, "https://cdn.example/logo.jpg")
    assert.equal(thread.messages[0].isMine, true)
    assert.equal(thread.messages[0].status, "PENDING_REVIEW")
    assert.deepEqual(thread.blockedState, { byMe: false, byOther: false })
})
