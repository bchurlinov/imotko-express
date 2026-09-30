# Express Contract: Chat Message Push Endpoint

**Date:** 2026-09-30
**Status:** web side implemented; Express side to implement
**Supersedes:** the "call Express to create messages" flow in `docs/chat-web-server-action-push-plan.md`

## Decision

The Next.js web app stays the writer for chat messages. It keeps its existing Prisma flow, emails and in-app notifications. After an **agency** message is committed as `DELIVERED`, the web app asks Express to send the mobile push for that message ID. Express derives the recipient, device tokens and eligibility. The web app never sends recipients, tokens or push payloads.

```text
Agency composer (web)
  -> POST /api/chat/conversations/:id/messages       (Next.js, unchanged)
  -> sendMessage(): Prisma transaction, DELIVERED
  -> requestChatPush(messageId)                      (Next.js, after response via `after`)
  -> POST {EXPRESS_API_URL}/api/v1/chat/messages/:messageId/push
  -> Express checks, then queueChatPushNotification(messageId)
  -> Expo
```

## What the web app sends

```http
POST /api/v1/chat/messages/:messageId/push
Authorization: Bearer <Supabase access token of the sending agency user>
```

- `:messageId` is the `Message.id`, URL-encoded.
- No request body and no `Content-Type` header.
- The token is the signed-in agency member's Supabase access token, the same identity `resolveChatViewer` already verifies.
- Timeout: 3 seconds on the web side. The request runs after the web response is sent (`next/server` `after`), so Express latency never slows the composer.
- Sent only when:
    - the sender viewer is `agency`, and
    - the message was delivered in the same transaction (not held for review).
- The web app does not retry. It logs a non-2xx status or network error as `[chat-push] request failed` and moves on. The response body is ignored.

Web implementation: `src/lib/chat/chat_push.js`, called from `sendMessage` in `src/lib/chat/conversation_service.js`.

## What Express must implement

### Route

In `src/api/v1/routes/chat/chat.routes.js`. The router already runs `router.use(resolveChatViewer)`:

```js
router.post(
    "/messages/:messageId/push",
    [id("messageId")],
    validateRequest,
    requireChatParticipant,
    handle(requestMessagePushController)
)
```

### Controller and service rules

Check these in order:

| # | Check | Result when it fails |
|---|---|---|
| 1 | Bearer token valid (`resolveChatViewer`) | `401 unauthorized` |
| 2 | Viewer is `client` or `agency` (`requireChatParticipant`) | `403 forbidden` |
| 3 | Message exists **and** `message.senderUserId === req.chatViewer.userId` | `404 messageNotFound`. Return the same response in both cases so the endpoint does not reveal whether other users' messages exist. |
| 4 | `message.kind === USER` and `message.status === DELIVERED` | `202 pushSkipped` |
| 5 | `message.deliveredAt` within the last **5 minutes** | `202 pushSkipped` (anti-replay) |
| 6 | No `ExpoPushTicket` row exists with this `messageId` | `202 pushSkipped` (idempotent) |
| — | All pass | `queueChatPushNotification(messageId)`, then `202 pushQueued` |

Notes:

- Return `202` right after queueing. Do not wait for Expo.
- Recipient eligibility (`CLIENT` role only), token lookup, badge count, payload and `DeviceNotRegistered` pruning stay inside the existing `chat_push.service.js`. No changes are needed there.
- Check 3 ties the push to the sender. A caller can only trigger pushes for messages they sent, and only once (check 6) and only soon after delivery (check 5).
- Add a `MESSAGE_NOT_FOUND: "messageNotFound"` entry to `CHAT_ERRORS`, or reuse `NOT_FOUND` (`conversationNotFound`) if you prefer. The web app ignores the code either way.
- Recommended: add `@@index([messageId])` to `ExpoPushTicket` so check 6 does not scan the table. This needs a migration in both repos, because the schema is shared.
- Known race: two concurrent requests can both pass check 6 before a ticket is written. The web app sends one request per message, so this is acceptable. Tighten it only if you add retries.
- Optional: rate-limit this route per user, like the other chat write routes.

### Suggested service sketch

```js
const PUSH_REQUEST_WINDOW_MS = 5 * 60 * 1000

export const requestMessagePush = async ({ messageId, viewer, now = new Date() }) => {
    const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, kind: true, status: true, senderUserId: true, deliveredAt: true },
    })
    if (!message || message.senderUserId !== viewer.userId) throw new ChatError(CHAT_ERRORS.MESSAGE_NOT_FOUND, 404)

    const fresh = message.deliveredAt && now - message.deliveredAt <= PUSH_REQUEST_WINDOW_MS
    if (message.kind !== MessageKind.USER || message.status !== MessageStatus.DELIVERED || !fresh) return false

    const alreadyPushed = await prisma.expoPushTicket.findFirst({ where: { messageId }, select: { id: true } })
    if (alreadyPushed) return false

    queueChatPushNotification(messageId)
    return true
}

export const requestMessagePushController = async (req, res) => {
    const queued = await requestMessagePush({ messageId: req.params.messageId, viewer: req.chatViewer })
    return chatResponse(res, 202, queued ? "pushQueued" : "pushSkipped")
}
```

### Response envelope

Use the common chat envelope:

```json
{ "data": null, "code": 202, "message": "pushQueued" }
```

## Environment

| Where | Variable | Value |
|---|---|---|
| Next.js (Vercel + `.env.local`) | `EXPRESS_API_URL` | Express base URL without `/api/v1`, e.g. `https://api.imotko.mk`. Already used by price trends; must be set for push. If unset, push requests are skipped silently. |
| Express only | `EXPO_ACCESS_TOKEN` | Unchanged. It never goes to the web app. |
| Express only | Supabase admin credentials used by `resolveChatViewer` | Unchanged. Must point at the same Supabase project as the web app, so web tokens verify. |

The request is server-to-server, so no CORS change is needed.

## Out of scope for now

- Client -> agency pushes (the push service only targets `CLIENT` recipients).
- Pushes for messages delivered later by web-side admin approval or email-verification release. Agency messages are always delivered immediately, so neither path involves an agency sender today. If needed later, those paths can call the same endpoint, but check 3 would need a service-level caller.

## Verification

Web (done): `npx vitest run src/lib/chat` covers:

- the bearer header, the encoded URL and the empty body
- skipping for clients, held messages, no session and a missing env var
- never throwing when Express fails or times out

Express (to do):

1. Unit or manual test for each row in the checks table.
2. curl with a real agency token:
   ```bash
   curl -i -X POST "$EXPRESS_API_URL/api/v1/chat/messages/<messageId>/push" -H "Authorization: Bearer <token>"
   ```
   A fresh message gives `202 pushQueued`. Repeating it after Expo accepts gives `202 pushSkipped`. Another user's token gives `404`.
3. End to end: agency sends from the web, the client's phone receives a `chat_message` push, and tapping it opens `/conversation/:id`.
