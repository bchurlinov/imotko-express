# Express: Chat `ConversationParticipant.removed` Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not commit.** Leave all work uncommitted and report "Ready to commit" at the end.

**Goal:** Make the Express chat API (repo `imotko-express`) treat a removed conversation exactly like the web app does now: per-side `ConversationParticipant.removed` boolean instead of the removal SYSTEM-message marker.

**Architecture:** Web and Express share one Postgres database and keep identical Prisma migration folders. The web repo already added the `removed` column, a backfill migration, and switched its inbox, thread and removal code to the flag. Express copies the same migration byte-for-byte, then replaces every `notRemovedWhere` / `removalEventFor` lookup with a read of the viewer's own participant row. The removal SYSTEM message is still written, because it is the visible line in the other side's thread and the audit record.

**Tech Stack:** Express (ESM, `#` import aliases), Prisma 7 (client in `generated/prisma`), PostgreSQL (Supabase), `node:test` via `tsx --test` (`pnpm test:chat`). Prettier: no semicolons, 4-space indent, double quotes, 120 cols, `arrowParens: "avoid"`.

**Spec:** `imotko/docs/superpowers/specs/2026-09-28-chat-removal-read-status-emails-design.md` (section "B. Remove conversation", updated 2026-10-04). Reference implementation: the web repo's working tree (`imotko/src/lib/chat/chat_removal.js`, `imotko/src/data/chat/inbox.js`, `imotko/prisma/migrations/20261004120000_conversation_participant_removed/migration.sql`).

All paths below are relative to `/Users/bojanchurlinov/Personal/imotko-express` unless prefixed with `imotko/`.

## Global Constraints

- Column: `removed Boolean @default(false)` on `ConversationParticipant`, the same as the web schema.
- Migration folder name: `20261004120000_conversation_participant_removed`. Its `migration.sql` must be **byte-identical** to the web repo's, because Prisma checksums each migration in `_prisma_migrations` and both repos run against the same database.
- The removal SYSTEM message (`clientRemovedConversation` / `agencyRemovedConversation`) is still created on removal. Only the *lookup* moves to the flag.
- API response shapes do not change (`{ removed: true }`, inbox items, thread). The mobile app (`imotko-mobile`) needs no change.
- Admin endpoints stay unfiltered: admins see removed conversations.
- JavaScript only, ESM, Prettier settings from `.prettierrc`.
- Never run `git commit` / `git push`.

## Review Focus

1. **Deploy order.** If Express code ships before the migration is applied, every inbox query fails on the unknown column `removed`. The migration must be applied first, by whichever repo deploys first; the other repo then sees it as already applied. This is covered in Task 1, Step 4 and in the Rollout section.
2. **Conversations removed before this change.** After the migration they must stay hidden from the remover and visible to the other side. The backfill covers this; Task 4's manual check verifies it on a conversation removed through the *old* code path.
3. **Client inbox search.** The client scope no longer has a `conversation` key. `...scope.conversation` spreads `undefined`, which is valid, but the search `OR` must still be applied. Pinned by a test in Task 2.
4. **Removing twice.** A double tap must not add a second SYSTEM line or touch the row again. Covered by the `participant.removed` early return in Task 3, and by a test of `removalParticipantData` together with the manual repeat call in Task 4.
5. **Remover trying to unblock.** `POST /conversations/:id/block` from the removing side must still return 409 and not clear `blockedAt`; clearing it would reopen the conversation for the other side. Pinned in Task 3 (the `toggleBlock` change) and checked manually in Task 4.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `prisma/schema/chat.prisma` | modify | add `removed` column |
| `prisma/migrations/20261004120000_conversation_participant_removed/migration.sql` | create (copy) | column and backfill |
| `src/api/v1/services/chat/chat_policy.js` | modify | drop `notRemovedWhere`; add pure `inboxParticipantWhere(viewer)` and `removalParticipantData(participant, now)` |
| `src/api/v1/services/chat/chat_policy.spec.js` | modify | tests for the two new helpers |
| `src/api/v1/services/chat/chat_inbox.service.js` | modify | inbox scope comes from the helper; `getThread` hides by `own.removed` |
| `src/api/v1/services/chat/chat_push.service.js` | modify | badge count uses the helper |
| `src/api/v1/services/chat/chat_removal.service.js` | modify | idempotency by flag; sets `removed: true` |
| `src/api/v1/services/chat/conversation.service.js` | modify | `loadViewerParticipant` stops loading the marker; `toggleBlock` checks `participant.removed` |
| `docs/chat-postman-test-guide.md` | modify | Flow B note about the flag |

---

### Task 1: Schema and shared migration

**Files:**
- Modify: `prisma/schema/chat.prisma` (model `ConversationParticipant`, after `deletedAt`)
- Create: `prisma/migrations/20261004120000_conversation_participant_removed/migration.sql` (copied)

**Interfaces:**
- Produces: Prisma field `ConversationParticipant.removed: boolean` (default `false`), available on `tx.conversationParticipant` and in `participants: true` selects.

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema/chat.prisma`, inside `model ConversationParticipant`, directly after the `deletedAt` line:

```prisma
  deletedAt          DateTime?            @db.Timestamptz(3)
  // Side removed the conversation from its own list; the row stays for the other side and admins.
  removed            Boolean              @default(false)
  messages           Message[]
```

- [ ] **Step 2: Copy the migration from the web repo (do not retype it)**

```bash
mkdir -p prisma/migrations/20261004120000_conversation_participant_removed
cp ../imotko/prisma/migrations/20261004120000_conversation_participant_removed/migration.sql prisma/migrations/20261004120000_conversation_participant_removed/migration.sql
```

For reference, the content is:

```sql
-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN "removed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: a side removed the conversation when it sent the removal SYSTEM message.
UPDATE "ConversationParticipant" AS p
SET "removed" = true
WHERE EXISTS (
    SELECT 1
    FROM "Message" AS m
    WHERE m."conversationId" = p."conversationId"
      AND m."senderParticipantId" = p."id"
      AND m."kind" = 'SYSTEM'
      AND m."bodyText" IN ('clientRemovedConversation', 'agencyRemovedConversation')
);
```

- [ ] **Step 3: Verify that both repos match and the client regenerates**

```bash
diff -r prisma/migrations ../imotko/prisma/migrations
diff prisma/schema/chat.prisma ../imotko/prisma/schema/chat.prisma
npx prisma validate
npx prisma generate
```

Expected: both `diff` commands print nothing, validate prints "valid", and generate succeeds.

- [ ] **Step 4: Apply the migration to the development database**

Use `.env.development` (`DIRECT_URL`). Only do this if the web repo has not already applied it to the same database:

```bash
npx dotenv -e .env.development -- npx prisma migrate status
npx dotenv -e .env.development -- npx prisma migrate deploy
```

Expected: `status` lists `20261004120000_conversation_participant_removed` as not yet applied, or reports the database is up to date if the web repo already applied it. `deploy` applies it, or reports no pending migrations.

---

### Task 2: Inbox scope and push badge read the flag

**Files:**
- Modify: `src/api/v1/services/chat/chat_policy.js`
- Modify: `src/api/v1/services/chat/chat_inbox.service.js:5,19-22,62-84`
- Modify: `src/api/v1/services/chat/chat_push.service.js:3,69-71`
- Test: `src/api/v1/services/chat/chat_policy.spec.js`

**Interfaces:**
- Consumes: `ConversationParticipant.removed` (Task 1).
- Produces: `inboxParticipantWhere(viewer: { type: "client" | "agency", userId?: string, agencyId?: string }) => object` exported from `chat_policy.js`. `notRemovedWhere` is deleted.

- [ ] **Step 1: Write the failing tests**

In `src/api/v1/services/chat/chat_policy.spec.js`, extend the import and append the tests:

```js
import { buildDedupeKey, inboxParticipantWhere, userLanguageToLocale, visibleMessageWhere } from "./chat_policy.js"
```

```js
test("client inbox scope keeps only the viewer's own non-removed participant rows", () => {
    assert.deepEqual(inboxParticipantWhere({ type: "client", userId: "u1" }), { userId: "u1", removed: false })
})

test("agency inbox scope keeps non-removed rows of delivered conversations", () => {
    assert.deepEqual(inboxParticipantWhere({ type: "agency", agencyId: "a1", userId: "u2" }), {
        agencyId: "a1",
        removed: false,
        conversation: { lastDeliveredAt: { not: null } },
    })
})

test("client inbox search can merge its OR into a scope without a conversation key", () => {
    const scope = inboxParticipantWhere({ type: "client", userId: "u1" })
    const where = { ...scope, conversation: { ...scope.conversation, OR: [{ id: "x" }] } }
    assert.deepEqual(where, { userId: "u1", removed: false, conversation: { OR: [{ id: "x" }] } })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:chat`
Expected: FAIL. The new tests error with `inboxParticipantWhere is not a function` (or a SyntaxError on the missing export).

- [ ] **Step 3: Implement the helper and drop `notRemovedWhere`**

In `src/api/v1/services/chat/chat_policy.js`:

1. Change the first import line to `import { MessageStatus, UserRole } from "#generated/prisma/enums.ts"`. `MessageKind` was only used by `notRemovedWhere`.
2. Replace the `notRemovedWhere` export with:

```js
// Inbox rows for a viewer: only their own side, and only if that side has not removed the conversation.
export const inboxParticipantWhere = viewer =>
    viewer.type === "client"
        ? { userId: viewer.userId, removed: false }
        : { agencyId: viewer.agencyId, removed: false, conversation: { lastDeliveredAt: { not: null } } }
```

In `src/api/v1/services/chat/chat_inbox.service.js`:

1. Replace the policy import (line 5) with:

```js
import { canRemoveConversation, inboxParticipantWhere, removalEventFor, visibleMessageWhere } from "./chat_policy.js"
```

   `removalEventFor` stays for now, because `getThread` still uses it. Task 3 removes it.
2. Delete the local `participantScope` function (lines 19-22) and replace its two call sites with `inboxParticipantWhere(viewer)`:
   - in `getInbox`: `const scope = inboxParticipantWhere(viewer)`
   - in `getUnreadConversationCount`: `return prisma.conversationParticipant.count({ where: { ...inboxParticipantWhere(viewer), unreadCount: { gt: 0 } } })`

In `src/api/v1/services/chat/chat_push.service.js`:

1. Line 3: `import { inboxParticipantWhere } from "./chat_policy.js"`
2. Badge count (around line 69):

```js
    const badge = await prisma.conversationParticipant.count({
        where: { ...inboxParticipantWhere({ type: "client", userId: recipient.userId }), unreadCount: { gt: 0 } },
    })
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:chat`
Expected: PASS, with `fail 0`.

- [ ] **Step 5: Confirm no references remain**

```bash
rg -n "notRemovedWhere|participantScope" src
```

Expected: no output.

---

### Task 3: Removal service, thread visibility, and block toggle read the flag

**Files:**
- Modify: `src/api/v1/services/chat/chat_policy.js` (add `removalParticipantData`)
- Modify: `src/api/v1/services/chat/chat_removal.service.js`
- Modify: `src/api/v1/services/chat/chat_inbox.service.js` (`getThread`, around lines 330-337)
- Modify: `src/api/v1/services/chat/conversation.service.js:18,61-77,306-315`
- Test: `src/api/v1/services/chat/chat_policy.spec.js`

**Interfaces:**
- Consumes: `ConversationParticipant.removed` (Task 1); `inboxParticipantWhere` already imported in `chat_inbox.service.js` (Task 2).
- Produces: `removalParticipantData(participant: { blockedAt: Date | null }, now: Date) => { removed: true, blockedAt: Date, unreadCount: 0, firstUnreadAt: null, reminderCount: 0 }` exported from `chat_policy.js`. `loadViewerParticipant` returns `{ conversation, participant }`, and `conversation` no longer has `messages`.

- [ ] **Step 1: Write the failing tests**

In `src/api/v1/services/chat/chat_policy.spec.js`, add `removalParticipantData` to the import from `./chat_policy.js` and append:

```js
test("removal marks the side removed, locks it, and clears its counters", () => {
    const now = new Date(Date.UTC(2026, 9, 4, 12, 0))
    assert.deepEqual(removalParticipantData({ blockedAt: null }, now), {
        removed: true,
        blockedAt: now,
        unreadCount: 0,
        firstUnreadAt: null,
        reminderCount: 0,
    })
})

test("removal keeps an earlier block time", () => {
    const earlier = new Date(Date.UTC(2026, 8, 20))
    const now = new Date(Date.UTC(2026, 9, 4, 12, 0))
    assert.equal(removalParticipantData({ blockedAt: earlier }, now).blockedAt, earlier)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:chat`
Expected: FAIL, because `removalParticipantData` is not exported.

- [ ] **Step 3: Implement**

In `src/api/v1/services/chat/chat_policy.js`, below `inboxParticipantWhere`:

```js
// Participant update for the side that removes a conversation. An existing block time is kept.
export const removalParticipantData = (participant, now) => ({
    removed: true,
    blockedAt: participant.blockedAt || now,
    unreadCount: 0,
    firstUnreadAt: null,
    reminderCount: 0,
})
```

In `src/api/v1/services/chat/chat_removal.service.js`:

1. Import line: `import { canRemoveConversation, removalEventFor, removalParticipantData } from "./chat_policy.js"`
2. In the `findUnique` select, delete the `messages: { ... }` line, so the select is `{ id: true, dedupeKey: true, participants: true }`.
3. Replace `if (conversation.messages.length) return { removed: true }` with:

```js
        if (participant.removed) return { removed: true }
```

4. Replace the `tx.conversationParticipant.update` data with:

```js
        await tx.conversationParticipant.update({
            where: { id: participant.id },
            data: removalParticipantData(participant, now),
        })
```

`MessageKind` is still used in `chat_removal.service.js` for the SYSTEM message create, so keep that import.

In `src/api/v1/services/chat/chat_inbox.service.js` `getThread`, replace:

```js
    if (!conversation) return null
    if (viewer.type !== "admin" && !findViewerParticipant(conversation.participants, viewer)) return null
    if (viewer.type === "agency" && !conversation.lastDeliveredAt) return null
    if (
        viewer.type !== "admin" &&
        conversation.messages.some(
            message => message.kind === MessageKind.SYSTEM && message.bodyText === removalEventFor(viewer.type)
        )
    )
        return null
```

with:

```js
    if (!conversation) return null
    if (viewer.type !== "admin") {
        const own = findViewerParticipant(conversation.participants, viewer)
        if (!own || own.removed) return null
    }
    if (viewer.type === "agency" && !conversation.lastDeliveredAt) return null
```

In the same function's `participants.select`, add `removed: true` after `deletedAt: true`. Change the policy import to `import { canRemoveConversation, inboxParticipantWhere, visibleMessageWhere } from "./chat_policy.js"`. `MessageKind` stays, because the preview code uses it.

In `src/api/v1/services/chat/conversation.service.js`:

1. Line 18: drop `removalEventFor` from the import: `import { buildDedupeKey, canStartAgencyInquiry, resolveInitialStatus } from "./chat_policy.js"`. Then run `rg -n "MessageKind" src/api/v1/services/chat/conversation.service.js`; if nothing uses it after this change, remove it from the enums import as well.
2. `loadViewerParticipant`: remove the `messages: { ... }` block from the select, leaving `{ id: true, closedAt: true, participants: true }`.
3. `toggleBlock`: replace `if (conversation.messages?.length) throw new ChatError(CHAT_ERRORS.CONVERSATION_BLOCKED, 409)` with:

```js
    if (participant.removed) throw new ChatError(CHAT_ERRORS.CONVERSATION_BLOCKED, 409)
```

- [ ] **Step 4: Run the tests and the leftover check**

```bash
pnpm test:chat
rg -n "removalEventFor" src
rg -n "conversation\.messages" src/api/v1/services/chat/conversation.service.js src/api/v1/services/chat/chat_removal.service.js
npx prettier --check src/api/v1/services/chat
```

Expected: tests pass with `fail 0`. `removalEventFor` appears only in `chat_policy.js` (its definition) and `chat_removal.service.js` (the SYSTEM message `bodyText`). The second `rg` prints nothing. Prettier reports clean for the touched files; run `npx prettier --write <file>` on any touched file it flags.

---

### Task 4: Manual end-to-end check and docs

**Files:**
- Modify: `docs/chat-postman-test-guide.md` (section "4. Flow B")

- [ ] **Step 1: Add a data-model note to the Postman guide**

In `docs/chat-postman-test-guide.md`, at the end of the first paragraph of section "4. Flow B — client removes a conversation from their own inbox", append:

```md
The remover's `ConversationParticipant.removed` is set to `true`; inbox, unread count, push badge and thread access all filter on that flag. The `clientRemovedConversation` / `agencyRemovedConversation` system message is still added as the visible line for the other side.
```

- [ ] **Step 2: Run the API against the development database**

```bash
pnpm dev
```

Using the Postman guide's Flow A, create a fresh conversation between a test client and a test agency manager. Then:

1. `POST {{baseUrl}}/api/v1/chat/conversations/{{conversationId}}/remove` as the client. Expected: `200 { "removed": true }`.
2. Repeat the same call. Expected: `200 { "removed": true }`, and the thread has only **one** `clientRemovedConversation` SYSTEM message (check as the agency in step 5).
3. `GET /api/v1/chat/conversations` (inbox) as the client. Expected: the conversation is absent.
4. `GET /api/v1/chat/conversations/{{conversationId}}` as the client. Expected: 404.
5. The same GET as the agency manager. Expected: 200, and the thread shows the "client removed" line.
6. `POST /api/v1/chat/conversations/{{conversationId}}/block` as the client. Expected: 409 `CONVERSATION_BLOCKED`.
7. In Prisma Studio (`npx dotenv -e .env.development -- npx prisma studio`), the client's `ConversationParticipant` row has `removed = true` and `blockedAt` set; the agency row has `removed = false`.

- [ ] **Step 3: Check the backfill on a removal made before this change**

Pick a conversation that was removed before the migration ran (Prisma Studio: a `Message` with `kind = SYSTEM` and `bodyText` of `clientRemovedConversation` or `agencyRemovedConversation`, created before 2026-10-04). Expected: the participant whose `id` equals that message's `senderParticipantId` has `removed = true`, and the other participant has `removed = false`. If none exists in development, note that in the hand-off report.

- [ ] **Step 4: Report**

Do not commit. Report: "Ready to commit — Express chat reads `ConversationParticipant.removed` (migration copied from web, inbox/unread/push badge/thread/removal/block use the flag, tests and Postman checks pass)".

---

## Rollout (production)

1. Apply `20261004120000_conversation_participant_removed` **once** to the shared production database before deploying either app: `prisma migrate deploy` from whichever repo deploys first.
2. Deploy web and Express. Order between them does not matter once the column exists, because both still write the SYSTEM marker and both now read the flag.
3. Old Express code still running during the deploy stays correct: it reads the SYSTEM marker, which is still written.
