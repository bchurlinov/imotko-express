# Chat — backend requirements for the mobile app

**Audience:** Express API (`/api/v1/chat`, `/api/v1/users`) maintainers
**Context:** the React Native app is adding in-app messaging (inbox, thread, "Send message" sheet) and push notifications on top of the existing chat API (`docs/chat-api.md`, `docs/chat-postman-test-guide.md`). This document lists exactly what the app reads, what it sends, and what is still missing on the backend.

Legend: **[EXISTS]** already documented and implemented · **[CONFIRM]** implemented, but we need you to confirm field names or behavior · **[NEW]** has to be built.

---

## 0. Summary checklist

| # | Item | Status |
|---|---|---|
| 1 | Keep the `{ data, code, message }` envelope, with `message` as a stable machine code on every error | [CONFIRM] |
| 2 | Send us the complete list of error codes, including the **unverified two-conversation limit** code and any rate-limit code | [CONFIRM] |
| 3 | Confirm or adjust the field names in the response shapes in §3 (inbox, thread, context, unread, lookup) | [CONFIRM] |
| 4 | Thread messages expose `isMine` (viewer-relative), `kind` and `status` | [CONFIRM] / [NEW] if missing |
| 5 | Thread `blocked` split by side: `{ byMe, byOther }` | [CONFIRM] / [NEW] if missing |
| 6 | Thread `property.available` boolean (live listing still published) | [CONFIRM] / [NEW] if missing |
| 7 | `PATCH /users/:id` accepts `phone`; confirm the format rules and the invalid-phone error code | [CONFIRM] |
| 8 | Push-token routes `POST` / `DELETE /users/push-tokens` | [NEW] |
| 9 | Send an Expo push when a message is **delivered** to a client | [NEW] |
| 10 | Answer the open questions in §7 | — |

---

## 1. Response envelope and errors

### 1.1 Envelope (keep as is)

```json
{ "data": {}, "code": 200, "message": null }
```

- `code` must equal the HTTP status.
- On success, `message` is `null` or a success code (`messageSent`, `reportSent`, …).
- On **every error**, `message` must be a **stable, camelCase machine code**. It must never be localized text or a stack message. The app translates the code itself (mk / en / sq / tr).
- `data` on error is `null`, or an object with extra details (see 1.3).

The app's HTTP wrapper reads `response.data.message` as the error code and the HTTP status as the status. Any code the app doesn't know shows a generic "The request failed" message. That works, but the user gets no useful guidance.

### 1.2 Error codes the app handles today

| Code | HTTP | Where the app can receive it | What the app does |
|---|---|---|---|
| `unauthorized` | 401 | any route | Refreshes the session, then shows the sign-in screen |
| `forbidden` | 403 | block / remove / report | Error toast |
| `conversationNotFound` | 404 | thread, send, actions | "Conversation unavailable" screen; drops the row from the inbox |
| `agencyNotAvailable` | 404 | create conversation | Disables the form and shows a notice |
| `conversationClosed` | 403 | send | Replaces the composer with a "closed" notice |
| `conversationBlocked` | 403 / 409 | send, block | Replaces the composer with a "blocked" notice |
| `messagingRestricted` | 403 | create, send | Disables the form and shows a notice |
| `messageEmpty` | 400 | create, send | Inline error |
| `messageTooLong` | 400 | create, send | Inline error |
| `validationFailed` | 400 | any route | Inline or generic error |

**Please provide:**

1. The code returned when an **unverified client exceeds the two-conversation limit** (for example `conversationLimitReached`). HTTP status and exact string.
2. The code returned when a client sends messages **too fast**, if a per-user send rate limit exists (for example `429 rateLimited`).
3. Any **other** code any of the participant routes in §3 can return that is not in the table above.

Codes the app never receives (guest and admin routes) don't need to change: `codeRequired`, `accountExists`, `useAgencyAccount`, `accountCreationLimited`, `messageApproved`, `messageRejected`, `messageAlreadyReviewed`, `reportResolved`.

### 1.3 Validation details (nice to have)

For `400 validationFailed`, please include which field failed, so the app can show the error next to the right input:

```json
{
  "data": null,
  "code": 400,
  "message": "validationFailed",
  "errors": [{ "field": "phone", "code": "invalidFormat" }]
}
```

(`errors` goes at the top level, next to `message`. The app's HTTP wrapper already reads it from there.)

---

## 2. General conventions

| Topic | Requirement |
|---|---|
| IDs | Strings (the app always calls `String(id)`, but please don't mix types between endpoints) |
| Timestamps | ISO 8601 in UTC with `Z`, e.g. `2026-09-30T10:00:00.000Z` |
| Ordering | Thread `messages` in **ascending** `createdAt` order (oldest first). Inbox items by last activity, newest first |
| `locale` query param | The app sends `mk`, `en` or `sq`. It also supports Turkish (`tr`) but currently sends `en` for those users; see Q1 |
| Localized fields | Property titles, and the text of system events, are resolved server-side for the requested `locale` and returned as **plain strings** |
| Message HTML | Output of the existing sanitizer. The app renders **only** `p`, `br`, `strong`/`b`, `em`/`i`, `ul`, `ol`, `li`, and `a` with `http`, `https`, `mailto` or `tel` hrefs. Any other tag is shown as plain text. If the web TipTap editor can produce other tags (headings, `u`, `s`, `blockquote`, `code`), tell us |
| Preview text | Inbox `preview` is **plain text**: HTML stripped, entities decoded, whitespace collapsed, at most about 140 characters |

---

## 3. Response shapes the app reads

These shapes are what the app is being built against. The field names are our best guess from the web client. **Please confirm each field, or send a real anonymized JSON sample for each endpoint.** The app has fallbacks for alternative names, but one confirmed name per field is much safer.

### 3.1 `GET /chat/unread` [EXISTS]

```json
{ "data": { "count": 3 }, "code": 200, "message": null }
```

`count` is the number of **conversations** with unread messages for the viewer. The app uses it for the tab badge and the app-icon badge, and the push `badge` value must be the same number (§5.3).

### 3.2 `GET /chat/context` [CONFIRM]

```json
{
  "data": {
    "emailVerified": true,
    "messagingFlagged": false
  },
  "code": 200,
  "message": null
}
```

| Field | Used for |
|---|---|
| `emailVerified` | Shows "Verify your email so agencies receive your messages right away" when `false` |
| `messagingFlagged` | Disables the send form with a restriction notice when `true` |

### 3.3 `GET /chat/conversations?locale=&limit=&q=` [CONFIRM]

```json
{
  "data": {
    "items": [
      {
        "id": "c_123",
        "agency": {
          "id": "a_1",
          "name": "Dom Agency",
          "logoUrl": "https://cdn…/logo-thumb.png"
        },
        "property": {
          "id": "p_9",
          "title": "Two-bedroom flat, Centar",
          "thumbnailUrl": "https://cdn…/photo-thumb.jpg"
        },
        "lastMessage": {
          "preview": "Yes, it's still available.",
          "createdAt": "2026-09-30T10:00:00.000Z",
          "isMine": false
        },
        "unreadCount": 2,
        "closed": false,
        "blocked": false
      }
    ],
    "hasMore": false
  },
  "code": 200,
  "message": null
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | conversation id |
| `agency.id`, `agency.name` | yes | the counterpart shown in the row. For future client↔client chat, a generic `counterpart` object with the same fields is also fine; just tell us which name you use |
| `agency.logoUrl` | no | small image URL. A `logo` object with `sizes.thumbnail` also works, but a single URL is preferred |
| `property` | no | `null` for general agency inquiries |
| `property.title` | yes if `property` | already localized for `locale` |
| `property.thumbnailUrl` | no | small image URL |
| `lastMessage.preview` | yes | plain text (§2) |
| `lastMessage.createdAt` | yes | the row's time label |
| `lastMessage.isMine` | nice to have | lets us render "You: …" later |
| `unreadCount` | yes | unread messages **for the viewer** in this conversation |
| `closed` | yes | boolean (a `closedAt` timestamp also works) |
| `blocked` | yes | boolean: blocked by either side |
| `hasMore` | yes | the app loads more by raising `limit` by 30, up to 300 |

### 3.4 `GET /chat/conversations/lookup?agencyId=&propertyId=` [EXISTS]

```json
{ "data": { "conversationId": "c_123" }, "code": 200, "message": null }
```

`conversationId` is `null` when none exists. When the viewer already has a conversation, the app opens it directly instead of the send form.

### 3.5 `GET /chat/conversations/:id?locale=` [CONFIRM — most important]

```json
{
  "data": {
    "conversation": {
      "id": "c_123",
      "agencyId": "a_1",
      "propertyId": "p_9",
      "closedAt": null
    },
    "counterpart": {
      "id": "a_1",
      "name": "Dom Agency",
      "logoUrl": "https://cdn…/logo-thumb.png"
    },
    "property": {
      "id": "p_9",
      "title": "Two-bedroom flat, Centar",
      "price": 95000,
      "thumbnailUrl": "https://cdn…/photo-thumb.jpg",
      "available": true
    },
    "messages": [
      {
        "id": "m_1",
        "kind": "USER",
        "bodyHtml": "<p>Is this still available?</p>",
        "createdAt": "2026-09-30T09:58:00.000Z",
        "isMine": true,
        "status": "DELIVERED"
      },
      {
        "id": "m_2",
        "kind": "SYSTEM",
        "bodyHtml": "<p>The agency closed this conversation.</p>",
        "createdAt": "2026-09-30T10:05:00.000Z",
        "isMine": false,
        "status": "DELIVERED"
      }
    ],
    "canReply": true,
    "closed": false,
    "blocked": { "byMe": false, "byOther": false }
  },
  "code": 200,
  "message": null
}
```

| Field | Required | Why the app needs it |
|---|---|---|
| `counterpart.name`, `counterpart.logoUrl` | yes / no | thread header |
| `conversation.agencyId` | yes | tapping the header opens the agency page |
| `property` | no (`null` for general inquiries) | pinned property card at the top of the thread |
| `property.price` | no | number (EUR), same as the property API |
| `property.available` | **yes** | `false` when the live listing is no longer `PUBLISHED`. The card then shows "No longer available" and is not tappable |
| `messages[].isMine` | **yes** | which side the bubble is drawn on. **Please compute it for the viewer.** Without it the app has to guess from `senderRole`/`senderUserId`, which will break for client↔client chat |
| `messages[].kind` | yes | `USER` or `SYSTEM`. System events render as grey centered pills and must carry human-readable text for `locale` in `bodyHtml` (or `body`) |
| `messages[].status` | yes for the viewer's own messages | `PENDING_REVIEW` shows "Awaiting review" under the bubble; anything else shows as sent. Messages from the counterpart that are still pending must **not** be returned |
| `canReply` | yes | `false` hides the composer |
| `closed` | yes | shows the "This conversation is closed" notice |
| `blocked.byMe` / `blocked.byOther` | **yes** | we show **"Unblock"** only when the viewer blocked the conversation; otherwise we show "You can no longer reply". A single boolean is not enough |

Up to 200 messages without pagination is fine for v1. If you later add pagination, prefer a cursor (`?before=<messageId>`) that returns messages in the same ascending order.

### 3.6 `POST /chat/conversations` [EXISTS]

Request: `{ "agencyId": "a_1", "propertyId": "p_9", "bodyHtml": "<p>…</p>" }`. `propertyId` is omitted for general inquiries.
Response: `{ "conversationId", "messageId", "created" }`, `201 messageSent`. No change needed.

The app sends only these HTML forms: `<p>…</p>`, `<br>`, and escaped text (`&amp; &lt; &gt; &quot; &#39;`).

### 3.7 `POST /chat/conversations/:id/messages` [EXISTS] — optional improvement

Currently returns `{ "messageId" }`. **Nice to have:** return the stored message in the same shape as §3.5 `messages[]`, so the app can replace its optimistic bubble without refetching the whole thread:

```json
{ "data": { "message": { "id": "m_3", "kind": "USER", "bodyHtml": "<p>Hi</p>", "createdAt": "…", "isMine": true, "status": "DELIVERED" } }, "code": 201, "message": "messageSent" }
```

### 3.8 Thread management [EXISTS]

| Route | Response `data` the app reads |
|---|---|
| `PATCH /conversations/:id/read` | nothing (`null`) |
| `POST /conversations/:id/block` | `{ "blocked": boolean }` — the new state **for the viewer** |
| `POST /conversations/:id/report` with body `{ "reason"? }` (≤ 500 chars) | nothing; `201 reportSent` |
| `POST /conversations/:id/remove` | `{ "removed": true }` |

---

## 4. User phone number [CONFIRM]

The send form has an **optional** phone field. When the user changes it, the app first calls the existing:

```
PATCH /api/v1/users/:id
{ "phone": "+389 70 123 456" }     // "" clears the phone
```

Then it creates the conversation. The agency reads the phone from the user record (per the chat docs).

Please confirm:

1. Which formats are accepted. The app allows `+`, digits, spaces, `(`, `)` and `-`, 6–20 characters. If the backend requires digits only (as the guest route does), either normalize server-side (**preferred**) or tell us and the app will strip the other characters before sending.
2. The error code and HTTP status for an invalid phone (e.g. `400 validationFailed` with `errors: [{ field: "phone" }]`).
3. That `""` clears the stored phone.

---

## 5. Push notifications [NEW]

### 5.1 Storage

Table `user_push_tokens` (naming is up to you):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid/cuid | PK |
| `userId` | FK → users | indexed |
| `token` | string, **unique** | Expo token: `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]` |
| `platform` | `ios` \| `android` | |
| `locale` | `mk` \| `en` \| `sq` | language for push text (the app sends `en` for `tr` users until Q1 is answered) |
| `createdAt`, `updatedAt`, `lastSeenAt` | timestamps | `lastSeenAt` is refreshed on every register call |

### 5.2 Routes (authenticated, same Supabase bearer token as the chat API)

**Register or refresh**

```
POST /api/v1/users/push-tokens
{ "token": "ExponentPushToken[…]", "platform": "ios", "locale": "mk" }
→ 200 { "data": null, "code": 200, "message": null }
```

- Upsert by `token`. If the token already belongs to **another** user (the device is shared and the account changed), reassign it to the caller.
- It is called on every app launch while the user is logged in with notifications allowed, after the OS rotates the token, and when the user changes the app language.
- Errors: `401 unauthorized`, `400 validationFailed` (for example when the token doesn't match `^ExponentPushToken\[.+\]$`).

**Unregister**

```
DELETE /api/v1/users/push-tokens/:token
→ 200 { "data": null, "code": 200, "message": null }
```

- `:token` arrives URL-encoded (`ExponentPushToken%5B…%5D`).
- Delete it only if it belongs to the caller. It is **idempotent**: return 200 when it's already gone.
- It is called on logout (**before** the session is revoked) and when the user turns push off in Profile.

Until these routes exist the app ignores the resulting 404s. Nothing breaks, but no pushes are delivered.

### 5.3 When to send

Send a push when a chat message becomes **delivered** to a **client** recipient:

- ✅ an agency member replies in a conversation
- ✅ an admin approves a pending agency message, which delivers it
- ❌ messages still `PENDING_REVIEW`
- ❌ system events (closed, removed, and so on)
- ❌ the recipient's own messages
- ❌ recipients with no tokens

**Collapsing:** if the same conversation gets several messages within about 60 seconds, sending one push per message is acceptable for v1. If your queue can coalesce them, prefer one push with the latest preview.

### 5.4 Payload (Expo push API)

```json
{
  "to": "ExponentPushToken[…]",
  "title": "Dom Agency",
  "body": "Yes, it's still available. When would you like to visit?",
  "sound": "default",
  "channelId": "chat",
  "badge": 3,
  "priority": "high",
  "data": {
    "type": "chat_message",
    "conversationId": "c_123",
    "url": "/conversation/c_123"
  }
}
```

| Field | Rule |
|---|---|
| `title` | Sender display name: the agency name (client↔client later: the user's display name) |
| `body` | Plain-text preview of the message: HTML stripped, entities decoded, **≤ 120 chars** with `…` appended when truncated |
| `channelId` | Exactly `chat` (Android notification channel created by the app) |
| `badge` | Recipient's unread **conversation** count, the same number `GET /chat/unread` returns after this message |
| `data.type` | Exactly `chat_message` |
| `data.conversationId` | The conversation id as a string |
| `data.url` | Exactly `/conversation/<conversationId>`. The app **only** navigates when `url` matches `^/conversation/[A-Za-z0-9_-]+$`, so conversation ids must fit that character set (tell us if they don't) |

Language: use the token's `locale` for any server-generated text (for example a fallback body such as "New message"). The message preview itself is the user's text and is not translated.

### 5.5 Delivery hygiene

1. Send batches of **≤ 100** messages per request to `POST https://exp.host/--/api/v2/push/send` (gzip is fine).
2. Store the ticket ids. After about 15 minutes, call `POST https://exp.host/--/api/v2/push/getReceipts`.
3. On a ticket or receipt error `DeviceNotRegistered`, **delete that token**.
4. On `MessageRateExceeded` or a 5xx, retry with exponential backoff.
5. Optional: turn on "Enhanced push security" in the Expo dashboard and send `Authorization: Bearer <EXPO_ACCESS_TOKEN>` (server-side only).
6. Push sending must never block or fail the chat request. Queue it.

### 5.6 Email notifications

The chat API already sends best-effort emails for new messages. With push added, see Q3.

---

## 6. Test data we need

- A **client** test account (email-verified) and one **unverified** client account.
- An **approved** test agency, with an agency-member account that can reply, and at least one **published** property it owns.
- A real, anonymized JSON sample of **each** response in §3 (`unread`, `context`, `conversations`, `lookup`, `conversations/:id`) with at least one property conversation, one general inquiry, and one system event.

---

## 7. Open questions

| # | Question |
|---|---|
| Q1 | Can the chat API accept `locale=tr`? If yes, the app will send it instead of falling back to `en`. |
| Q2 | Is there a per-user send rate limit? If so, what code, status and window? |
| Q3 | Should chat emails to a client be **suppressed or delayed** (for example sent only if the message is still unread after N minutes) when the client has an active push token? We recommend "delay 15 min, skip if read". |
| Q4 | Can `blocked` ever be set by **both** sides at once? What should the client see then? (The app plans to show "You blocked this conversation" with Unblock.) |
| Q5 | Is `unreadCount` in the inbox the number of unread **messages**, and is `GET /chat/unread` the number of **conversations**? We assume yes for both. |
| Q6 | Do conversation ids fit `[A-Za-z0-9_-]+`? (This is required by the push deep-link check in §5.4.) |
| Q7 | For future client↔client chat, will the thread keep the generic `counterpart` object, and will `isMine` stay viewer-relative? If yes, the mobile app needs no changes when that ships. |
