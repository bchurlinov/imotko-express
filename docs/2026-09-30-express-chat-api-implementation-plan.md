# Express Chat API Implementation Plan

**Date:** 2026-09-30  
**Status:** ready for implementation  
**Scope:** Express.js API only  
**Reference implementation:** `/Users/bojanchurlinov/Personal/imotko`

## Goal

Add an independent Express implementation of the existing Imotko client-to-agency chat. The Next.js
implementation remains active and unchanged. Both applications use the same Supabase project, PostgreSQL
database, and Prisma chat tables, so a conversation created or changed through either application must be
immediately valid and visible to the other.

This plan implements the current behavior in the Imotko source code, including changes made after the
original design document. In particular:

- chat is always enabled; Express will not add `CHAT_ENABLED`;
- the old email contact form is outside this API's scope;
- account-creation limits are 5 per IP per 10 minutes, 20 per IP per 24 hours, and 100 globally per hour;
- removing a conversation is supported;
- new-message email and agency email preferences are supported;
- the Next application remains the only process that schedules unread reminder emails.

## Non-goals

- Do not change or remove the Next.js chat implementation.
- Do not move Next server components or dashboard pages to Express.
- Do not implement `PRIVATE_INQUIRY` or `AGENCY_OUTREACH` entry points yet.
- Do not implement client-owned property publishing, collaboration opt-in, outreach pricing, or the 3/5
  agency-contact lock.
- Do not add realtime messaging, attachments, or automated message-content scanning.
- Do not create a second unread-reminder scheduler in Express while the Next scheduler is active.
- Do not change the existing Prisma chat schema for Phase 1.

## Shared-runtime rules

Because Next and Express will mutate the same rows, all state transitions must be safe when the other
application acts at nearly the same time.

1. Message approval and delivery must use conditional updates on `PENDING_REVIEW`. Only the process that
   changes the status may increment unread state, create a notification, or send email.
2. Report resolution, conversation closing, and messaging-flag changes must be idempotent.
3. Conversation creation must keep the existing unique `dedupeKey` recovery path for concurrent creates.
4. Account-verification release must be safe if Next and Express both observe verification.
5. Express sends immediate new-message email for messages delivered by Express. Next continues doing the
   same for messages delivered by Next.
6. Next remains the sole scheduler for the first-day and second-day unread reminder emails. Its shared
   database query naturally includes messages delivered through Express.
7. Express must not invoke a Next API route or rely on a Next session cookie.

## API contract

All chat responses use the existing chat envelope so clients can reuse the same translation keys:

```json
{
    "data": {},
    "code": 200,
    "message": null
}
```

Expected errors use the current chat codes in `message`, including `unauthorized`, `forbidden`,
`messagingRestricted`, `conversationBlocked`, `conversationClosed`, `accountCreationLimited`,
`useAgencyAccount`, `unverifiedConversationLimit`, `conversationDailyLimit`, `messageEmpty`,
`messageTooLong`, `agencyNotAvailable`, `conversationNotFound`, `messageAlreadyReviewed`, and
`validationFailed`.

Unexpected errors return HTTP 500 with `message: "somethingWentWrong"`. Database errors and sensitive
authentication details must never be returned to the client.

### Authenticated chat routes

Mount `src/api/v1/routes/chat/chat.routes.js` at `/api/v1/chat`.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/conversations` | List the caller's inbox, with search and incremental pagination |
| `POST` | `/conversations` | Start or append to an `AGENCY_INQUIRY` |
| `GET` | `/conversations/lookup` | Find the caller's thread for an agency/property pair |
| `GET` | `/conversations/:id` | Return a shaped thread for the caller |
| `POST` | `/conversations/:id/messages` | Send a message |
| `PATCH` | `/conversations/:id/read` | Mark the caller's participant read |
| `POST` | `/conversations/:id/block` | Close or reopen the thread from the caller's side |
| `POST` | `/conversations/:id/report` | Report the thread |
| `POST` | `/conversations/:id/remove` | Remove the thread from the caller's inbox |
| `GET` | `/unread` | Return the number of conversations with unread messages |
| `GET` | `/context` | Return client verification or agency email-preference context |

`GET /conversations` accepts:

- `q`: optional search string, trimmed, maximum 100 characters;
- `locale`: `mk`, `en`, or `sq`, default `mk`;
- `limit`: integer from 1 to 300, default 30.

It returns the current `items` and `hasMore` shape from the Next data layer. Inbox items must also include
`kind` so later clients can distinguish conversation types without another API change.

`GET /conversations/:id` accepts `locale` and returns the current thread shape, including property status,
read/seen state, agency-member sender labels, permissions, and the agency-side CRM match. Keep the current
200-message thread limit.

### Guest route

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/chat/guest` | Create a client account and either send a held inquiry or request verification |

The body contract is:

- `name`: required trimmed string, maximum 80 characters;
- `email`: required normalized email;
- `phone`: optional digits-only string, maximum 30 characters;
- `bodyHtml`: required string;
- `agencyId`: required string;
- `propertyId`: optional nullable string;
- `locale`: `mk`, `en`, or `sq`;
- `verificationChoice`: `verify` or `later`;
- `company`: honeypot field.

Preserve the existing guest outcomes exactly:

- a filled honeypot returns fake success without a write;
- an existing agency/admin email returns `useAgencyAccount`;
- an existing client returns `codeRequired` for `verify` or `accountExists` for `later`;
- `verify` creates the Prisma client account, requests a Supabase magic link, and does not create a
  conversation yet;
- `later` creates the Prisma client account and a `requiresAdminReview` pending message;
- a failure after account creation removes the newly created Prisma rows;
- only successful account creation consumes the Redis account-creation counters.

### Admin chat routes

Mount `src/api/v1/routes/admin/chat.routes.js` at `/api/v1/admin/chat`.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/messages/pending` | Paginated pending-review messages |
| `GET` | `/conversations` | Paginated conversations with agency/email/date filters |
| `GET` | `/conversations/:id` | Admin thread, pending messages, sender state, and read state |
| `GET` | `/reports` | Paginated unresolved reports |
| `PATCH` | `/messages/:id/approve` | Deliver one pending message |
| `PATCH` | `/messages/:id/reject` | Reject one pending message |
| `PATCH` | `/conversations/:id/close` | Close a conversation |
| `PATCH` | `/reports/:id/resolve` | Resolve a report |
| `PATCH` | `/users/:id/messaging-flag` | Flag or unflag messaging for a user |

Admin list routes use a page size of 20. Validate `page` as a positive integer, `from` and `to` as ISO
dates, and reject `from > to`. Validate `flagged` as a boolean.

## Implementation tasks

### Task 1: Establish a trusted chat authentication context

**Files:**

- modify `src/api/v1/middlewares/verifySupabaseToken.js` only if a reusable token extraction helper is needed;
- add `src/api/v1/middlewares/resolveChatViewer.js`;
- add `src/api/v1/services/chat/chat_identity.service.js`;
- add `src/api/v1/services/chat/chat_permissions.js`;
- add focused specs beside these files.

**Work:**

1. Extract the bearer access token and call `supabaseAdmin.auth.getUser(token)` for a current,
   server-validated Supabase identity. Do not use `getSession()` for authorization.
2. Resolve the Prisma user in this order:
   - `User.supabaseUserId === authUser.id`;
   - normalized verified email where `supabaseUserId` is null, then atomically set `supabaseUserId`;
   - create a new `CLIENT` plus `Client` row from trusted Supabase data if neither exists.
3. Never promote a user based on request data or `user_metadata`. Authorization comes from `User.role` in
   PostgreSQL. Existing agency/admin users may be linked by verified email but new users default to client.
4. If Supabase now reports a confirmed email and `User.emailVerified` is null, set it and invoke the
   idempotent pending-message release service after the transaction commits.
5. Build one of these viewer objects:
   - client: `{ type, userId }`;
   - agency: `{ type, userId, agencyId, memberId, role }`, requiring an active membership;
   - admin: `{ type, userId }`.
6. Copy the current agency message permissions:
   - every active member role can read;
   - collaborator, agent, manager, and admin can write/block;
   - manager and admin can remove agency conversations.
7. Add `requireChatParticipant` and `requireChatAdmin` middleware helpers. Resource authorization must still
   be repeated in the service query so middleware cannot create a time-of-check/time-of-use gap.

**Verification:**

- valid Supabase client, agency, and admin tokens resolve the correct database viewer;
- a JWT `sub` that differs from `User.id` still resolves via `supabaseUserId`;
- a legacy email match is linked once and rejects a conflicting Supabase ID;
- suspended/deleted agency memberships cannot access the shared inbox;
- JWT/app metadata cannot grant a database role;
- newly confirmed users trigger release once.

### Task 2: Add chat response, constants, policy, and sanitization modules

**Files:**

- add `src/api/v1/services/chat/chat_constants.js`;
- add `src/api/v1/services/chat/chat_error.js`;
- add `src/api/v1/services/chat/chat_policy.js`;
- add `src/api/v1/services/chat/chat_format.js`;
- add `src/api/v1/services/chat/chat_sanitizer.js`;
- add `src/api/v1/controllers/chat/chat_response.js`;
- update `package.json` and `pnpm-lock.yaml` with a server HTML sanitizer if required;
- add pure policy and sanitizer specs.

**Work:**

1. Copy current constants: 10 unanswered messages, 2 unverified conversations, 10 new conversations per
   day, 4,000 message-text characters, 2 reminders, 500 report-reason characters.
2. Copy dedupe-key generation and visible-message rules.
3. Sanitize rich text with only `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, and `a[href]`.
4. Permit only `http:`, `https:`, and `mailto:` links. Add `rel="nofollow ugc noopener"` and
   `target="_blank"`.
5. Produce both sanitized `bodyHtml` and plain `bodyText`. Reject empty content and text longer than 4,000
   characters. Also cap the raw HTML input through route validation so a large tag-only payload cannot make
   the sanitizer do excessive work.
6. Add a chat-specific error responder that preserves the `{ data, code, message }` envelope.

**Verification:**

- scripts, event handlers, unsafe links, and unsupported elements are removed;
- formatting and safe links survive;
- HTML-only empty messages fail with `messageEmpty`;
- exactly 4,000 text characters pass and 4,001 fail;
- policy tests cover visibility of pending/rejected messages for client, agency, and admin viewers.

### Task 3: Implement participant notifications and idempotent delivery

**Files:**

- add `src/api/v1/services/chat/chat_notifications.service.js`;
- add `src/api/v1/services/chat/message_delivery.service.js`;
- add `src/api/v1/services/chat/messaging_flag.service.js`;
- add localized chat notification strings under `src/messages/` or a dedicated chat locale module;
- add service specs.

**Work:**

1. Resolve a person participant to its user and an agency participant to its active assigned member, falling
   back to the agency owner.
2. Deliver a message with a conditional `updateMany` from `PENDING_REVIEW` to `DELIVERED`. Stop immediately
   when another process already changed it.
3. In the same transaction as the successful delivery:
   - set `deliveredAt` and `Conversation.lastDeliveredAt`;
   - mark the sender side read;
   - increment the recipient unread count;
   - set `firstUnreadAt` only when it is currently null;
   - create one in-app notification only when unread transitions from zero to one.
4. Copy the rolling unanswered-message calculation. Count only non-rejected user messages after the other
   side's latest delivered reply and after `messagingUnflaggedAt` when applicable.
5. Flag only client-role senders automatically. Manual admin flags may target any role.
6. Store notification text in the recipient's language and metadata with the existing web conversation URL.

**Verification:**

- two concurrent delivery attempts create one delivery, unread increment, notification, and email request;
- subsequent unread messages increment the count without creating another in-app notification;
- agency assignment falls back correctly when the assigned member is inactive;
- the eleventh unanswered message is refused and flags the client;
- unflagging establishes a fresh unanswered-count window.

### Task 4: Implement conversation writes

**Files:**

- add `src/api/v1/services/chat/conversation.service.js`;
- add `src/api/v1/services/chat/chat_removal.service.js`;
- add `src/api/v1/controllers/chat/chat.controller.js`;
- add `src/api/v1/routes/chat/chat.routes.js`;
- modify `src/api/v1/routes/index.js`;
- add controller/service specs.

**Work:**

1. Port agency and published-property availability checks, including hidden agencies.
2. Build the same property snapshot at conversation creation.
3. Implement lookup and start/append behavior for `AGENCY_INQUIRY` only.
4. Enforce the current daily and unverified-conversation limits only when creating a new thread.
5. Recover from Prisma `P2002` on `dedupeKey` by loading the raced conversation and appending once.
6. Implement sending, mark-read, close/reopen, report, and remove with authorization derived from the viewer.
7. Preserve these semantics:
   - agency viewers without write permission cannot send or block;
   - either participant's block prevents both sides from sending;
   - only the blocker can reopen;
   - removed threads cannot be reopened through the block endpoint;
   - report reasons are trimmed to 500 characters;
   - removal writes the side-specific system marker, rejects pending messages, clears the remover's unread
     notifications, blocks that side, and changes the dedupe key so a new inquiry can later be created.
8. Never accept sender user ID, sender participant ID, agency membership, message status, or delivery state
   from the request body.

**Validation:**

- validate every `:id`, `agencyId`, and optional `propertyId` as a non-empty bounded string rather than UUID;
- validate `bodyHtml` as a string with a bounded raw length;
- validate report reason as an optional string no longer than 500 characters;
- call `validateRequest` on every route with validators.

**Verification:**

- happy path for verified client creation and agency reply;
- unverified client messages stay pending and invisible to the agency;
- property must belong to the selected approved agency and be published;
- blocked, closed, removed, missing, and unauthorized threads return the correct code;
- permission tests cover viewer, collaborator, agent, manager, and admin agency-member roles;
- concurrent conversation creation produces one conversation and two intended messages only when two
  separate sends actually occurred.

### Task 5: Implement inbox and thread reads

**Files:**

- add `src/api/v1/services/chat/chat_inbox.service.js`;
- extend `src/api/v1/controllers/chat/chat.controller.js`;
- extend `src/api/v1/routes/chat/chat.routes.js`;
- add query-shaping specs.

**Work:**

1. Port inbox scoping, removal filtering, search, localized property title selection, and `hasMore` behavior.
2. Agency inboxes list only conversations with `lastDeliveredAt != null` so held guest inquiries remain
   invisible.
3. Clients see delivered messages plus all of their own statuses; agencies see delivered messages only.
4. Port property live/snapshot shaping and hide `externalId` from clients.
5. Port seen-state calculation and shared agency read attribution.
6. Return counterpart email, phone, member-since date, and verification only to agency viewers.
7. Port the agency CRM match by case-insensitive email or exact phone and gate the link by CRM permission.
8. Return `kind` on inbox items and threads even though Phase 1 creates only `AGENCY_INQUIRY`.
9. Return chat context:
   - client `emailVerified`;
   - agency `emailNotificationsEnabled` and whether the member may manage it.

**Verification:**

- a pending-only conversation appears to its client but not the agency;
- searches match counterpart names and localized property names;
- removed conversations disappear only for the removing side;
- thread visibility differs correctly for client, agency, and admin;
- no client response leaks phone, email, CRM data, or internal property ID;
- pagination limits are capped server-side.

### Task 6: Implement guest account creation and Redis counters

**Files:**

- add `src/api/v1/services/chat/chat_guest.service.js`;
- add `src/api/v1/services/chat/account_creation_limit.service.js`;
- add `src/api/v1/controllers/chat/chat_guest.controller.js` or keep it in `chat.controller.js`;
- extend `src/api/v1/routes/chat/chat.routes.js`;
- update `.env.example` with the public web application base URL used in callbacks and notification links;
- add guest-flow and limit specs.

**Work:**

1. Use the shared Redis client. Implement a preflight read and post-success record operation so failed
   signups consume no quota.
2. Normalize IPv4-mapped IPv6 and collapse IPv6 addresses to `/64`. Unknown IPs skip per-IP counters but
   still use the global counter.
3. Fail open when Redis is absent or temporarily unavailable, with structured error logging.
4. Create `User(role: CLIENT)` and `Client` atomically using normalized email and an IP address snapshot.
5. For `verificationChoice: verify`, request a Supabase OTP/magic link with `shouldCreateUser: true` and a
   redirect into the existing Imotko messages page.
6. For `verificationChoice: later`, create the held inquiry with `requiresAdminReview: true`.
7. Handle concurrent email creation without returning a generic 500 or deleting another request's account.

**Verification:**

- honeypot, invalid fields, existing roles, existing client choices, verify, and later branches;
- 5/10-minute, 20/day, and 100/hour boundaries;
- counters update only after a successful account creation outcome;
- a Supabase failure rolls back only the newly created Prisma account;
- guest messages never reach the agency before admin approval.

### Task 7: Implement immediate chat email

**Files:**

- add `src/api/v1/services/chat/chat_email.service.js`;
- add Handlebars templates under `src/messages/email/`;
- reuse the existing AWS SES configuration through a small shared mail client if practical;
- add rendering and recipient specs.

**Work:**

1. Copy the current recipient selection and grouping rules.
2. Send names, property title, and a dashboard link only. Never include message text, counterpart email, or
   counterpart phone.
3. Respect `Agency.emailNotificationsEnabled`.
4. Send only after the database transaction commits and only for the first unread message in a stretch.
5. Treat email as best effort: log failures and keep the chat mutation successful.
6. Do not add the unread digest scheduler or cron route to Express. Document that Next owns that singleton
   job while both applications are active.

**Verification:**

- correct locale, recipient, and dashboard link for client and agency sides;
- assigned active member and owner fallback;
- disabled agency email preference suppresses mail;
- generated content contains no message body or private contact information;
- email failure does not roll back message delivery.

### Task 8: Implement admin reads and moderation

**Files:**

- add `src/api/v1/services/chat/chat_admin.service.js`;
- add `src/api/v1/controllers/chat/chat_admin.controller.js`;
- add `src/api/v1/routes/admin/chat.routes.js`;
- modify `src/api/v1/routes/index.js`;
- add admin route/service specs.

**Work:**

1. Port pending messages, conversation filters, open reports, and complete admin-thread reads.
2. Use conditional status updates for approve/reject. A repeated or raced action returns
   `messageAlreadyReviewed` without side effects.
3. Closing an already closed conversation succeeds idempotently; a missing conversation returns 404.
4. Resolving an already resolved report succeeds idempotently; a missing report returns 404.
5. Flag/unflag users through the shared messaging-flag service and create the corresponding localized
   in-app notification.
6. Require a current database `ADMIN` role for every route.

**Verification:**

- non-admin tokens receive 403 without revealing whether the target exists;
- filters and pagination match the Next admin screens;
- approval delivers exactly once under concurrent Next/Express moderation;
- rejection remains invisible to the sender as a status change;
- admin thread includes pending messages and both sides' read state.

### Task 9: Integrate verification and account deletion lifecycle

**Files:**

- add `src/api/v1/services/chat/chat_lifecycle.service.js`;
- modify `src/api/v1/services/users/users.service.js`;
- modify `src/api/v1/controllers/users/users.controller.js` and `src/api/v1/routes/users/users.routes.js` as
  required for ownership checks;
- add lifecycle and authorization specs.

**Work:**

1. Release non-guest-review pending messages when verified email changes from null to confirmed.
2. Make release conditional and safe against the Next session synchronizer running at the same time.
3. Before deleting a user inside the database transaction:
   - set their chat participants' `deletedAt`;
   - add the `accountDeleted` system message;
   - close each conversation;
   - notify the counterpart when the conversation had delivered content.
4. Derive the Supabase user to delete from the authenticated identity. Do not accept a caller-provided
   `sessionId` as deletion authority.
5. Require the caller to own the user being updated/deleted unless a database admin performs the action.
6. Apply the same ownership rule to notification list, status update, and deletion routes. Scope notification
   mutation queries by `recipientId`, not just notification ID.

**Verification:**

- a user cannot update/delete another user or read/mutate another user's notifications;
- account deletion preserves conversation history and display name for the other side;
- deleted users can no longer authenticate or send;
- verification releases eligible messages once and leaves `requiresAdminReview` guest messages pending.

### Task 10: Documentation, generation, and end-to-end verification

**Files:**

- update `.env.example`;
- update `docs/.env.example` if it remains the onboarding source;
- add `docs/chat-api.md` with request/response examples and ownership rules;
- optionally add a `test:chat` script that runs only the chat specs.

**Work:**

1. Document required environment values without secrets:
   - existing Supabase keys and URL;
   - existing database and Redis URLs;
   - existing AWS SES values;
   - a canonical Imotko web base URL for links and magic-link redirects.
2. Run formatting on touched files.
3. Run `pnpm prisma generate`. No migration is expected because the schema already matches the reference
   implementation.
4. Run all chat specs and the affected user/notification specs.
5. Run manual API checks with client, agency viewer, agency writer, and admin bearer tokens.
6. Perform shared-database interoperability checks:
   - create through Next and read/reply through Express;
   - create through Express and read/reply through Next;
   - approve in one application while attempting approval in the other;
   - verify a held user while both applications are available;
   - confirm the Next reminder job includes Express-created unread rows and sends only once.

## Required verification matrix

| Scenario | Expected result |
|---|---|
| Verified client starts inquiry | Delivered immediately; agency unread and first-unread notification increment |
| Unverified signed-in client starts inquiry | Stored pending; visible only to sender/admin |
| Guest chooses later | Prisma account and admin-review message created; agency sees nothing |
| Guest chooses verify | Prisma account and Supabase magic link created; no conversation yet |
| Admin approves held message | Delivered exactly once and becomes visible to agency |
| Admin rejects held message | Sender still sees it as sent; agency never sees it |
| Viewer-role agency member replies | 403 `forbidden` |
| Collaborator/agent/manager/admin replies | Delivered |
| Participant blocks thread | Neither side can send; blocker may reopen |
| Admin closes thread | Neither side can send; participants cannot reopen it |
| Client removes thread | Hidden for client, retained for agency, pending messages rejected |
| Agency manager removes thread | Hidden for agency, retained for client |
| Agency viewer/agent removes thread | 403 `forbidden` |
| Eleventh unanswered client message | Refused and account flagged |
| Account unflagged | New unanswered window begins at unflag time |
| Account deleted through Express | Thread history retained and counterpart notified |
| Next and Express approve simultaneously | One delivery, notification, unread increment, and email |
| Next reminder cron runs | Includes unread messages created through Express; Express runs no competing cron |

## Completion criteria

The Express chat implementation is complete when:

- all routes above exist with validation, authentication, and service-level authorization;
- the current Phase 1 behavior is available without modifying the Next implementation;
- Next-created and Express-created chat state is interchangeable;
- moderation and verification transitions are idempotent across both applications;
- immediate notifications and emails work for Express writes;
- reminder emails remain owned by the existing Next scheduler;
- account deletion and existing notification endpoints enforce ownership;
- relevant happy, failure, permission, concurrency, and lifecycle tests pass;
- Prisma client generation succeeds without a new migration;
- manual interoperability checks pass.
