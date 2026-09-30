# Next.js Chat Server Action Push Integration Plan

**Date:** 2026-09-30  
**Status:** ready to implement  
**Scope:** Next.js web application integration with the existing Imotko Express chat API

## Decision

The Next.js web app must call Imotko Express to create chat messages. It must not call Expo directly and it must not receive or select a recipient Expo token.

Imotko Express is the source of truth for chat authorization, recipient selection, message delivery state, unread counts, notification records, and Expo push delivery. Its existing message endpoint already queues a best-effort push after a committed `DELIVERED` message.

```text
Browser form or composer
  -> Next.js Server Action
  -> POST Imotko Express /api/v1/chat/conversations/:id/messages
  -> Express authorizes, saves, and delivers the message
  -> Express queues Expo push to the derived recipient device tokens
```

The server action forwards the signed-in user's Supabase access token. It does not use an Express service secret or a Supabase service-role key. This preserves the same permission checks that the mobile application uses.

## Existing Express contract

### Endpoint to call

```http
POST /api/v1/chat/conversations/:conversationId/messages
Authorization: Bearer <Supabase access token>
Content-Type: application/json

{
  "bodyHtml": "<p>Hello</p>"
}
```

Successful responses are HTTP `201` with the common envelope:

```json
{
  "data": { "messageId": "..." },
  "code": 201,
  "message": "messageSent"
}
```

Relevant expected failures are `401 unauthorized`, `403 forbidden`, `403 conversationClosed`, `403 conversationBlocked`, `403 messagingRestricted`, `404 conversationNotFound`, `400 messageEmpty`, `400 messageTooLong`, and `429 rateLimited`.

### What Express already does

No Express code change is needed for the normal **web sender -> client mobile recipient** case:

1. `resolveChatViewer` verifies the forwarded bearer token with Supabase and derives the database viewer.
2. `sendMessage` verifies that viewer is a participant and may send to the conversation.
3. It sanitizes and writes the message in a database transaction.
4. Once a message is committed as `DELIVERED`, `queueChatPushNotification(messageId)` runs asynchronously.
5. The push service derives the other conversation participant and loads their stored Expo tokens. It sends through Expo and removes tokens reported as `DeviceNotRegistered`.

The queue call is intentionally non-blocking. A `201` means the chat message was accepted and stored; it does not mean a device has displayed the notification.

### Current role limitation to preserve or deliberately change

The current push service sends only when the recipient has the `CLIENT` role. Therefore:

| Sender | Recipient | Current result |
|---|---|---|
| Web agency user | Client mobile user | Push is sent when the message is delivered. |
| Web client user | Agency mobile user | No push is sent by the current code. |

If agency users must receive mobile pushes too, make that a separate Express product decision before implementing it. The push service needs an explicit recipient-eligibility rule and the agency membership/device ownership behavior must be defined first. Do not bypass this by having Next.js call Expo.

## Next.js implementation

This assumes an App Router application with a standard server Supabase client at `@/lib/supabase/server`. Adjust only that import to match the web repository's existing Supabase helper.

### 1. Add a server-only API base URL

Add this to the **Next.js web app's** environment files, not to the browser configuration:

```dotenv
IMOTKO_API_URL=https://api.example.com
```

Rules:

- Do not name this `NEXT_PUBLIC_IMOTKO_API_URL`; Server Actions can read normal environment variables.
- Do not put `EXPO_ACCESS_TOKEN`, a Supabase service-role key, or a static Express bypass key in the web app.
- Configure the production value to the HTTPS public base URL of Imotko Express. A Server Action performs a server-to-server request, so browser CORS configuration is not involved.

### 2. Add the server action

Create `app/chat/actions.ts` in the Next.js repository (or place this beside the existing chat composer action). Keep the `"use server"` directive at the top.

```ts
"use server"

import { createClient } from "@/lib/supabase/server"

type SendMessageResult =
    | { ok: true; messageId: string }
    | { ok: false; code: string; field?: "bodyHtml" }

type ApiEnvelope<T> = {
    data: T | null
    code: number
    message: string | null
}

const API_URL = process.env.IMOTKO_API_URL

function apiErrorCode(response: Response, body: unknown) {
    if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
        return body.message
    }

    if (response.status === 401) return "unauthorized"
    if (response.status === 403) return "forbidden"
    if (response.status === 429) return "rateLimited"
    return "somethingWentWrong"
}

export async function sendChatMessage(
    conversationId: string,
    bodyHtml: string
): Promise<SendMessageResult> {
    // Server Actions can be invoked by a direct POST request. Authenticate and
    // validate here, then let Express repeat its authoritative validation.
    if (!conversationId || conversationId.length > 200) {
        return { ok: false, code: "conversationNotFound" }
    }

    if (typeof bodyHtml !== "string" || !bodyHtml.trim()) {
        return { ok: false, code: "messageEmpty", field: "bodyHtml" }
    }

    if (!API_URL) {
        console.error("IMOTKO_API_URL is not configured")
        return { ok: false, code: "somethingWentWrong" }
    }

    const supabase = await createClient()
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()

    if (claimsError || !claimsData?.claims?.sub) {
        return { ok: false, code: "unauthorized" }
    }

    const {
        data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
        return { ok: false, code: "unauthorized" }
    }

    let response: Response
    try {
        response = await fetch(
            `${API_URL}/api/v1/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ bodyHtml }),
                cache: "no-store",
                signal: AbortSignal.timeout(10_000),
            }
        )
    } catch (error) {
        console.error("Chat API request failed", {
            error: error instanceof Error ? error.message : String(error),
        })
        return { ok: false, code: "somethingWentWrong" }
    }

    const body = (await response.json().catch(() => null)) as ApiEnvelope<{ messageId: string }> | null

    if (!response.ok || !body?.data?.messageId) {
        return { ok: false, code: apiErrorCode(response, body) }
    }

    return { ok: true, messageId: body.data.messageId }
}
```

Notes about this action:

- The action does not accept `recipientId`, `pushToken`, a user role, or any push payload. Those are server-owned facts derived by Express.
- `getClaims()` validates the caller before the action proceeds. `getSession()` is used only to obtain the raw access token to forward; its embedded user object is not used for authorization.
- The local validation exists for fast UI feedback and to protect the action. Express remains authoritative for HTML sanitization, message limits, account restrictions, conversation membership, and delivery state.
- Logging intentionally excludes `bodyHtml` and the access token.
- The action returns a stable error code suitable for the existing localized UI. It must not expose raw backend error bodies to the browser.

### 3. Call the action from the client composer

Use the action in a client component. The component owns loading, optimistic UI, and error rendering; the action owns the authenticated API request.

```tsx
"use client"

import { useState, useTransition } from "react"
import type { FormEvent } from "react"
import { sendChatMessage } from "@/app/chat/actions"

export function ChatComposer({ conversationId }: { conversationId: string }) {
    const [bodyHtml, setBodyHtml] = useState("")
    const [errorCode, setErrorCode] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setErrorCode(null)
        const submittedBodyHtml = bodyHtml

        startTransition(async () => {
            const result = await sendChatMessage(conversationId, submittedBodyHtml)

            if (!result.ok) {
                setErrorCode(result.code)
                return
            }

            setBodyHtml("")
            // Re-fetch the thread or reconcile the optimistic message here.
            // A push result is not part of this response and must not affect UI success.
        })
    }

    return (
        <form onSubmit={submit}>
            <textarea
                name="message"
                value={bodyHtml}
                onChange={event => setBodyHtml(event.target.value)}
                disabled={isPending}
            />
            <button type="submit" disabled={isPending}>
                Send
            </button>
            {errorCode ? <p role="alert">{errorCode}</p> : null}
        </form>
    )
}
```

Replace the minimal textarea with the project's existing rich-text composer. The submitted value must be the sanitized-HTML candidate expected by the Express `bodyHtml` contract. Do not render unsanitized user HTML locally; render the sanitized message returned by a thread refetch.

If the existing composer has a rich-text editor, use its current HTML value in place of `bodyHtml` and pass that value directly to `sendChatMessage` from the submit handler.

### 4. Refresh the thread after success

Choose one consistent strategy:

1. **Recommended initially:** show an optimistic pending bubble, call the action, then refetch `GET /api/v1/chat/conversations/:id` after success. Replace the optimistic bubble with the API thread data.
2. **Alternative:** have the action return a fully shaped message only after Express exposes a response contract for it. Do not reconstruct sender/recipient state or a push result in Next.js.

The final API read handles transformations performed by Express, including sanitized text, moderation status, and concurrent messages from another participant.

## Express checklist

No new endpoint should be added. Before deploying the web change, verify that these existing pieces are deployed together:

- `POST /api/v1/chat/conversations/:id/messages` is mounted and protected by `resolveChatViewer` plus `requireChatParticipant`.
- `queueChatPushNotification` is called only after the message has been delivered.
- Expo tokens are registered by the mobile app at `POST /api/v1/users/push-tokens` under the same Supabase user identity.
- The push-token migration has been applied and `EXPO_ACCESS_TOKEN` is present only in the Express deployment.
- Invalid Expo tokens are pruned after Expo reports `DeviceNotRegistered`.

## Verification plan

### Automated tests

In the Next.js repository, add action tests with mocked Supabase and `fetch`:

| Case | Expected assertion |
|---|---|
| No Supabase session | No fetch occurs; action returns `unauthorized`. |
| Valid session and successful API result | Fetch has `Authorization: Bearer <token>`, posts only `bodyHtml`, and returns `messageId`. |
| Empty message | No fetch occurs; action returns `messageEmpty`. |
| API `403 conversationBlocked` | Action returns the same stable code. |
| API timeout/network failure | Action returns `somethingWentWrong` and does not expose details. |
| Conversation ID containing `/` | URL path segment is encoded. |

Keep the existing Express chat tests that prove push queueing is invoked only for delivered messages. Add or retain a unit test that confirms a pending-review message does not send a push.

### Manual end-to-end check

1. Sign in to the web application as an agency user.
2. Sign in to the mobile app as the client recipient and register its Expo token.
3. Send a message from the web chat composer.
4. Confirm the web request returns `201 messageSent` quickly, even if Expo delivery is slow.
5. Confirm the mobile device receives a `chat_message` notification with the expected conversation ID and opens the correct thread.
6. Disable notification permission or unregister the token. Confirm web message delivery still succeeds without a push.
7. Try a user outside the conversation. Confirm the action forwards the token but Express rejects the request with `403`.
8. Send a message that needs admin review. Confirm it creates no push until moderation releases it.

## Deployment order

1. Deploy the current Express chat and push implementation, migration, and environment configuration.
2. Validate mobile token registration and an API-originated push in staging.
3. Add `IMOTKO_API_URL` to the Next.js deployment environment.
4. Deploy the Server Action and composer integration.
5. Run the end-to-end web-to-mobile test in staging before production rollout.

## Explicit non-goals

- No direct Expo request from the browser or Next.js web app.
- No static API secret in client-side JavaScript.
- No endpoint that accepts arbitrary recipient IDs or Expo tokens for a chat push.
- No claim that push display is guaranteed by the `POST /messages` response.
