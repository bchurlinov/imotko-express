# Chat API Postman test guide

This guide is a runnable checklist for the Express chat API. It covers every implemented participant, guest, and administrator endpoint, including creating and sending messages, closing a conversation, removing it from an inbox, moderation, reports, blocking, and the expected error paths.

Use test accounts and a disposable approved agency/property. Do not use a real customer conversation: the write requests below create database records, send notifications, and can send email.

The API base paths are:

```text
{{baseUrl}}/api/v1/chat
{{baseUrl}}/api/v1/admin/chat
```

Every response uses this envelope:

```json
{
    "data": {},
    "code": 200,
    "message": null
}
```

## 1. Create a Postman environment

Create an environment called `Imotko chat - local` and define these variables. Keep access tokens only in Postman's current-value field; never export or commit them.

| Variable            | Example / source                                          | Purpose                                                                                    |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `baseUrl`           | `http://localhost:5505`                                   | Express server origin; do not add a trailing slash.                                        |
| `clientToken`       | Supabase access token for a client test user              | Authenticates client requests.                                                             |
| `agencyToken`       | Supabase access token for an active agency member         | Authenticates agency requests. The member must have a write-capable role to send or block. |
| `agencyReaderToken` | Optional active agency collaborator/reader token          | Tests read-only agency access.                                                             |
| `adminToken`        | Supabase access token for a database admin                | Authenticates moderation requests.                                                         |
| `agencyId`          | ID of an `APPROVED`, non-hidden agency                    | Target agency for an inquiry.                                                              |
| `propertyId`        | Optional ID of a `PUBLISHED` property owned by `agencyId` | Attaches a property snapshot to a conversation.                                            |
| `conversationId`    | Set by the create-inquiry request                         | Used by conversation requests.                                                             |
| `messageId`         | Set by a message-creation request                         | Used by approve/reject tests.                                                              |
| `reportId`          | Set by the reports list                                   | Used by report-resolution tests.                                                           |
| `clientUserId`      | Set from an admin conversation/thread response            | Used by the messaging-flag test.                                                           |

For authenticated participant requests, add this header:

```http
Authorization: Bearer {{clientToken}}
Content-Type: application/json
```

Replace `clientToken` with `agencyToken` or `adminToken` for the relevant flow. The server validates the token with Supabase Auth, then derives the database user role and active agency membership. Headers and request bodies cannot grant a role.

### Useful Postman Tests scripts

Place these in the **Tests** tab after the named requests to save IDs automatically.

```javascript
const response = pm.response.json()
pm.test("uses the chat response envelope", () => {
    pm.expect(response).to.have.property("data")
    pm.expect(response).to.have.property("code")
    pm.expect(response).to.have.property("message")
})
```

After **Create or append an inquiry**:

```javascript
pm.environment.set("conversationId", pm.response.json().data.conversationId)
pm.environment.set("messageId", pm.response.json().data.messageId)
```

After **Send a message**:

```javascript
pm.environment.set("messageId", pm.response.json().data.messageId)
```

After **List open reports**, set `reportId` from `data.rows[0].id` only after confirming that row is the report created by your test.

## 2. Recommended test data and message body

Use a harmless, unique message body so your test records are easy to recognize:

```json
{
    "bodyHtml": "<p>Postman chat test {{timestamp}}. Is this still available?</p>"
}
```

Set `timestamp` in a collection pre-request script if desired:

```javascript
pm.variables.set("timestamp", new Date().toISOString())
```

Chat accepts only safe, limited HTML (`p`, `br`, `strong`, `em`, lists, and safe links). It strips scripts and unsafe URLs. The resulting plain text must be non-empty and at most 4,000 characters; the raw input maximum is 50,000 characters.

## 3. Flow A — verified client starts, sends, reads, and closes a conversation

This is the normal delivered-message flow. The client must be a database `CLIENT`; the agency must be approved, and the optional property must be published and owned by that agency. A verified client message is delivered immediately.

### A1. Check client context

```http
GET {{baseUrl}}/api/v1/chat/context
Authorization: Bearer {{clientToken}}
```

This returns client context, including email-verification state. Confirm the client is not messaging-flagged and, for an immediate-delivery test, that its email is verified.

Expected: `200`, with `message: null`.

### A2. Create an agency inquiry

```http
POST {{baseUrl}}/api/v1/chat/conversations
Authorization: Bearer {{clientToken}}
Content-Type: application/json

{
  "agencyId": "{{agencyId}}",
  "propertyId": "{{propertyId}}",
  "bodyHtml": "<p>Postman chat test {{timestamp}}. Is this still available?</p>"
}
```

`propertyId` is optional. Omit the property field entirely to start a general agency inquiry.

Expected first request:

```json
{
    "data": {
        "conversationId": "…",
        "messageId": "…",
        "created": true
    },
    "code": 201,
    "message": "messageSent"
}
```

Save both IDs using the Tests script above. Repeating the same client + agency + property combination appends a message to the existing conversation and returns `created: false`; it does not create a duplicate conversation.

### A3. Read the thread as the client

```http
GET {{baseUrl}}/api/v1/chat/conversations/{{conversationId}}?locale=en
Authorization: Bearer {{clientToken}}
```

This returns the conversation metadata, property snapshot/live-property status, counterpart details safe for the client, message history (up to 200 visible messages), and `canReply`, `closed`, and `blocked` state.

Expected: `200`; the first message is in `data.messages`. A normal verified message has no moderation status in a participant response.

### A4. Read the agency inbox and thread

```http
GET {{baseUrl}}/api/v1/chat/conversations?locale=en&limit=30
Authorization: Bearer {{agencyToken}}
```

```http
GET {{baseUrl}}/api/v1/chat/conversations/{{conversationId}}?locale=en
Authorization: Bearer {{agencyToken}}
```

The inbox lists delivered conversations. The agency thread adds the client's phone/email/verification state where the agency viewer is permitted to see it.

Expected: `200`. The normal verified client inquiry appears in the agency inbox and the agency thread reports `canReply: true` for a write-capable member.

### A5. Send a reply as the agency

```http
POST {{baseUrl}}/api/v1/chat/conversations/{{conversationId}}/messages
Authorization: Bearer {{agencyToken}}
Content-Type: application/json

{
  "bodyHtml": "<p>Yes — this is a Postman test reply.</p>"
}
```

This creates a user message from the agency side, delivers it, increments the client's unread state, and queues a best-effort notification/email only when appropriate.

Expected:

```json
{
    "data": { "messageId": "…" },
    "code": 201,
    "message": "messageSent"
}
```

### A6. Check unread count and mark the client side read

```http
GET {{baseUrl}}/api/v1/chat/unread
Authorization: Bearer {{clientToken}}
```

```http
PATCH {{baseUrl}}/api/v1/chat/conversations/{{conversationId}}/read
Authorization: Bearer {{clientToken}}
```

The first request returns `{ "count": number }`. The second clears the viewer's unread count, first-unread timestamp, and reminder count for this conversation.

Expected read response:

```json
{ "data": null, "code": 200, "message": null }
```

### A7. Close as an admin

```http
PATCH {{baseUrl}}/api/v1/admin/chat/conversations/{{conversationId}}/close
Authorization: Bearer {{adminToken}}
```

This is the implemented close operation. It sets `closedAt` for the conversation; it is idempotent, so repeating it still returns success. Participants can continue to read the history, but no side can send a new message.

Expected:

```json
{ "data": null, "code": 200, "message": "conversationClosed" }
```

### A8. Confirm a closed conversation rejects a message

```http
POST {{baseUrl}}/api/v1/chat/conversations/{{conversationId}}/messages
Authorization: Bearer {{clientToken}}
Content-Type: application/json

{ "bodyHtml": "<p>This must be rejected because the thread is closed.</p>" }
```

Expected:

```json
{ "data": null, "code": 403, "message": "conversationClosed" }
```

## 4. Flow B — client removes a conversation from their own inbox

This is the chat "delete" operation. It does **not** delete the conversation or its messages from the database, and it does not delete the other participant's history. It adds a system event, blocks the remover's side, clears their relevant notifications, rejects still-pending messages, and removes the conversation from that viewer's inbox.

Use a fresh, open Flow A conversation if you want to test remove before closing it.

```http
POST {{baseUrl}}/api/v1/chat/conversations/{{conversationId}}/remove
Authorization: Bearer {{clientToken}}
```

Expected:

```json
{
    "data": { "removed": true },
    "code": 200,
    "message": null
}
```

Run `GET /conversations` as the client: that conversation no longer appears. Run the same inbox request as the agency: its copy remains visible. Repeating remove as the same side is idempotent and again returns `removed: true`.

Agency removal is allowed only for agency managers or admins. A client, or a lower-permission agency member, receives `403 forbidden`.

```http
POST {{baseUrl}}/api/v1/chat/conversations/{{conversationId}}/remove
Authorization: Bearer {{agencyToken}}
```

## 5. Flow C — block and unblock a conversation

Blocking is distinct from removal: it keeps the thread in the inbox but prevents new messages from either side. Test it against a fresh open conversation.

```http
POST {{baseUrl}}/api/v1/chat/conversations/{{conversationId}}/block
Authorization: Bearer {{clientToken}}
```

Expected first call:

```json
{ "data": { "blocked": true }, "code": 200, "message": null }
```

Repeat the exact request to unblock it; expected `blocked: false`. Agency blocking requires a write-capable agency role. If the other side already blocked the conversation, an attempt to block it returns `409 conversationBlocked`.

While blocked, test a send request from the other side:

```http
POST {{baseUrl}}/api/v1/chat/conversations/{{conversationId}}/messages
Authorization: Bearer {{agencyToken}}
Content-Type: application/json

{ "bodyHtml": "<p>This must not be sent while blocked.</p>" }
```

Expected: `403 conversationBlocked`.

## 6. Flow D — report a conversation, then resolve the report

Any participant can file a report. Reporting does not close, block, or remove the conversation automatically.

```http
POST {{baseUrl}}/api/v1/chat/conversations/{{conversationId}}/report
Authorization: Bearer {{clientToken}}
Content-Type: application/json

{ "reason": "Postman moderation test" }
```

`reason` is optional and is limited to 500 characters.

Expected:

```json
{ "data": null, "code": 201, "message": "reportSent" }
```

Then use the admin endpoint:

```http
GET {{baseUrl}}/api/v1/admin/chat/reports?page=1
Authorization: Bearer {{adminToken}}
```

Find your report by its reason/conversation ID and save its row ID as `reportId`. The response is paginated: `data.rows`, `data.total`, `data.page`, and `data.totalPages`.

```http
PATCH {{baseUrl}}/api/v1/admin/chat/reports/{{reportId}}/resolve
Authorization: Bearer {{adminToken}}
```

Expected:

```json
{ "data": null, "code": 200, "message": "reportResolved" }
```

Resolving again is idempotent. A non-admin token is rejected with `403 forbidden`.

## 7. Flow E — unverified registered client and admin review

An unverified registered client can start at most two conversations. Their messages remain pending review rather than appearing in the agency inbox. This flow is safest with a dedicated unverified client account.

1. Create an inquiry with **A2**, using that unverified client's token.
2. Confirm the client can read its own thread with **A3**.
3. As the agency, call `GET /conversations`. The conversation should not appear yet because there is no delivered message.
4. As admin, list pending messages:

```http
GET {{baseUrl}}/api/v1/admin/chat/messages/pending?page=1
Authorization: Bearer {{adminToken}}
```

Find the `data.rows` entry with your conversation ID and save its `id` as `messageId`.

```http
PATCH {{baseUrl}}/api/v1/admin/chat/messages/{{messageId}}/approve
Authorization: Bearer {{adminToken}}
```

Expected:

```json
{ "data": null, "code": 200, "message": "messageApproved" }
```

Approval conditionally claims the pending message and delivers it only once, even if the existing Next chat and this API act at the same time. The agency inbox should now show the conversation. A repeated approve/reject of that same message returns `409 messageAlreadyReviewed`.

To test rejection instead, use a different pending message:

```http
PATCH {{baseUrl}}/api/v1/admin/chat/messages/{{messageId}}/reject
Authorization: Bearer {{adminToken}}
```

Expected: `200 messageRejected`. The message is not delivered; the agency inbox does not gain it.

## 8. Flow F — guest inquiry

Guest creation has no bearer token. It creates a client account and applies Redis-backed creation limits (per IP: 5/10 minutes, 20/24 hours; global: 100/hour). Use a unique test email on each destructive guest test.

### F1. Verify first (account + magic link, no conversation yet)

```http
POST {{baseUrl}}/api/v1/chat/guest
Content-Type: application/json

{
  "name": "Postman Guest",
  "email": "postman-verify-{{timestamp}}@example.test",
  "phone": "38970123456",
  "agencyId": "{{agencyId}}",
  "propertyId": "{{propertyId}}",
  "bodyHtml": "<p>Postman guest verification test.</p>",
  "locale": "en",
  "verificationChoice": "verify",
  "company": ""
}
```

Expected:

```json
{
    "data": { "codeRequired": true, "accountCreated": true },
    "code": 201,
    "message": "codeRequired"
}
```

The API requests a Supabase magic link, but deliberately does **not** create a conversation in this choice. Complete the email flow, get a token for that user, then use Flow A to create the inquiry.

### F2. Send later (held message for moderation)

```http
POST {{baseUrl}}/api/v1/chat/guest
Content-Type: application/json

{
  "name": "Postman Guest",
  "email": "postman-later-{{timestamp}}@example.test",
  "phone": "38970123456",
  "agencyId": "{{agencyId}}",
  "propertyId": "{{propertyId}}",
  "bodyHtml": "<p>Postman guest message awaiting review.</p>",
  "locale": "en",
  "verificationChoice": "later",
  "company": ""
}
```

Expected:

```json
{
    "data": {
        "sent": true,
        "accountCreated": true,
        "conversationId": "…",
        "pendingReview": true
    },
    "code": 201,
    "message": "messageSent"
}
```

Use Flow E's admin list/approve or reject requests to moderate it. A guest thread held for review keeps later client messages held until that review is resolved.

### F3. Guest edge cases

| Test                          | Request change                           | Expected result                                                           |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| Honeypot                      | Set `company` to any non-empty string    | Fake `200 messageSent` response; no account or message is created.        |
| Existing client, `verify`     | Reuse the email of an existing client    | `200 codeRequired` with `{ "codeRequired": true }`; no duplicate account. |
| Existing client, `later`      | Reuse the email of an existing client    | `200 accountExists` with `{ "existingAccount": true }`.                   |
| Existing agency/admin account | Reuse an agency/admin email              | `409 useAgencyAccount`.                                                   |
| Too many creations            | Exceed the limits above from the same IP | `429 accountCreationLimited`.                                             |

## 9. Participant utility and visibility requests

### List inbox

```http
GET {{baseUrl}}/api/v1/chat/conversations?q=postman&locale=en&limit=30
Authorization: Bearer {{clientToken}}
```

`q`, `locale` (`mk`, `en`, or `sq`), and `limit` (1–300) are optional. The response has `data.items` and `data.hasMore`. Inbox data contains a short message preview, unread count, localised property title, and closed state—not the full thread.

### Look up an existing client inquiry

```http
GET {{baseUrl}}/api/v1/chat/conversations/lookup?agencyId={{agencyId}}&propertyId={{propertyId}}
Authorization: Bearer {{clientToken}}
```

This returns `{ "conversationId": "…" }` or `{ "conversationId": null }`. For agency viewers it always returns `conversationId: null`; only the client side can use it to avoid creating a duplicate inquiry.

### Unread count

```http
GET {{baseUrl}}/api/v1/chat/unread
Authorization: Bearer {{agencyToken}}
```

For participants this returns unread conversation count. For admins, it returns the pending-review message count instead.

### Role/permission checks

Use `agencyReaderToken` against a known agency thread:

```http
GET {{baseUrl}}/api/v1/chat/conversations/{{conversationId}}
Authorization: Bearer {{agencyReaderToken}}
```

Expected: `200` when that user is an active agency member. Then send a message using the same token. A reader/collaborator without write permission receives `403 forbidden`, while a manager, agent, or agency admin can reply and block. Only an agency manager/admin can remove the agency-side thread.

## 10. Full admin operations

All requests in this section require `Authorization: Bearer {{adminToken}}`. Pagination is 20 rows per page, with optional `page` starting at 1.

### List and filter conversations

```http
GET {{baseUrl}}/api/v1/admin/chat/conversations?page=1&agencyId={{agencyId}}&email=postman&from=2026-09-01&to=2026-09-30
Authorization: Bearer {{adminToken}}
```

Every filter is optional. `from`/`to` must be strict ISO dates and `from` cannot be later than `to`. The result has conversation summaries, dates, closed state, and message/report counts.

### Inspect a complete thread

```http
GET {{baseUrl}}/api/v1/admin/chat/conversations/{{conversationId}}?locale=en
Authorization: Bearer {{adminToken}}
```

Admins get a read-only thread with message delivery status, seen state, both sides' read status, and `data.pendingMessages` for still-pending content.

### Flag/unflag a user from messaging

First obtain a client user ID from the admin thread or pending-message response (`senderUser.id`), then:

```http
PATCH {{baseUrl}}/api/v1/admin/chat/users/{{clientUserId}}/messaging-flag
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{ "flagged": true }
```

Expected:

```json
{ "data": { "messagingFlagged": true }, "code": 200, "message": null }
```

While flagged, the client cannot start or send messages (`403 messagingRestricted`). Run the same request with `{ "flagged": false }` to unflag the test user. Setting the already-current state is idempotent.

## 11. Validation, security, and expected error checks

These requests are useful regression checks after the happy paths.

| Scenario                                  | Request                                                                                  | Expected                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| No token                                  | `GET /api/v1/chat/unread` without `Authorization`                                        | `401 unauthorized`                                                                       |
| Unknown/unavailable conversation          | Get a thread using a made-up ID                                                          | `404 conversationNotFound`                                                               |
| Invalid agency/property                   | Start an inquiry with an unapproved/hidden agency, or property not published/owned by it | `404 agencyNotAvailable`                                                                 |
| Empty text after sanitization             | Send `{"bodyHtml":"<script>alert(1)</script>"}`                                          | `400 messageEmpty`                                                                       |
| Unsafe HTML removed safely                | Send `<p>Hello <script>alert(1)</script><a href="javascript:alert(1)">bad</a></p>`       | `201` if text remains; reading the thread must not include executable HTML or unsafe URL |
| Oversized message                         | More than 4,000 text characters (or 50,000 raw characters)                               | `400 messageTooLong` or validation failure                                               |
| Invalid locale                            | `?locale=fr`                                                                             | `400 validationFailed`                                                                   |
| Invalid phone in guest request            | Include non-digits in `phone`                                                            | `400 validationFailed`                                                                   |
| Invalid report reason                     | More than 500 characters                                                                 | `400 validationFailed`                                                                   |
| Participant accesses another conversation | Use a token not belonging to either side                                                 | `404 conversationNotFound`                                                               |
| Non-admin moderation                      | Call any `/api/v1/admin/chat/...` endpoint with client/agency token                      | `403 forbidden`                                                                          |

For all errors, verify the response still uses the same `data`, `code`, and `message` envelope. Validation errors intentionally do not expose internal database or authentication details.

## 12. Suggested execution order

1. Configure tokens and approved agency/property IDs.
2. Run Flow A through A6 with a verified client and capture IDs.
3. Run Flow C (block/unblock) on that open conversation, then Flow D (report/resolve).
4. Either run Flow B to remove it, or run A7/A8 to close it—use separate fresh conversations if you need to test both effects cleanly.
5. Run Flow E with a dedicated unverified client.
6. Run Flow F with unique guest emails, then approve/reject its held content as admin.
7. Run the security/error cases with known disposable data.

There is no hard-delete endpoint for conversations. **Remove** is per-side inbox removal, while **close** is admin-only and stops further replies. User-account deletion is part of the existing users API rather than this chat route group; it retains chat history, closes related conversations, and writes a system event.
