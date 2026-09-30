# Chat mobile integration

This describes the initial chat and push-notification contract between the Expo mobile application and the Imotko API.

## Chat API contract

### Authentication, localization, and response envelope

- All participant routes use `Authorization: Bearer <Supabase access token>` and are rooted at `/api/v1/chat`.
- The supported locales are `mk` (Macedonian), `en` (English), `sq` (Albanian), and `tr` (Turkish). Send the selected locale in the `locale` query parameter on inbox and thread requests. Turkish is fully supported; do not fall back to English.
- Dates are ISO 8601 UTC strings. IDs are strings.
- Every response has this envelope:

```json
{ "data": {}, "code": 200, "message": null }
```

`code` always matches the HTTP status. On success, `message` is `null` or a success code such as `messageSent`; on failure it is always a stable, non-localized camel-case code. The app owns translation of all error and success messages.

For request validation failures, the API returns `400 validationFailed`, optionally with field details:

```json
{
    "data": null,
    "code": 400,
    "message": "validationFailed",
    "errors": [{ "field": "phone", "code": "invalidFormat" }]
}
```

### Errors the mobile app must handle

| HTTP | `message` | Mobile behavior |
|---:|---|---|
| 401 | `unauthorized` | Refresh the Supabase session; otherwise return to sign-in. |
| 403 | `forbidden` | Show a generic access error. |
| 403 | `messagingRestricted` | Disable the message composer and show the restriction notice. |
| 403 | `conversationClosed` | Hide the composer and show the closed state. |
| 403 | `conversationBlocked` | Hide the composer and show the blocked state. |
| 403 | `unverifiedConversationLimit` | Explain that email verification is required before starting more conversations. The limit is two lifetime conversations while unverified. |
| 404 | `conversationNotFound` | Leave the thread and remove the stale inbox item. |
| 404 | `agencyNotAvailable` | Disable the contact form and show that the agency/listing is unavailable. |
| 400 | `messageEmpty` | Show an inline composer error. |
| 400 | `messageTooLong` | Show an inline composer error; rendered text is limited to 4,000 characters. |
| 400 | `validationFailed` | Use `errors[].field` for an inline field error when present. |
| 429 | `conversationDailyLimit` | Explain that no more than ten new conversations may be started in 24 hours. |
| 429 | `rateLimited` | Retry later; this is the API-wide rate limiter. |
| 500 | `somethingWentWrong` | Show a generic retryable error. |

Unknown codes must use the generic error UI, not display the raw code to the user.

### Initial load and navigation flow

After authenticated application startup, call these in parallel:

```text
GET /api/v1/chat/context
GET /api/v1/chat/unread
GET /api/v1/chat/conversations?locale=<mk|en|sq|tr>&limit=30
```

- `context.data.emailVerified` controls the verification guidance for a client.
- `context.data.messagingFlagged` disables message creation and replies for a restricted client.
- `unread.data.count` is the number of conversations with unread messages and is the inbox/app badge value.
- The inbox is ordered by newest activity. `unreadCount` on an inbox item is the number of unread messages for that conversation. Increase `limit` by 30 to load more, up to 300, while `hasMore` is `true`.

When the user taps **Contact agency**, first call:

```text
GET /api/v1/chat/conversations/lookup?agencyId=<id>&propertyId=<id optional>
```

If `data.conversationId` is present, open that thread. Otherwise, update the optional phone number first if it changed, then create the conversation:

```text
PATCH /api/v1/users/:currentUserId    { "phone": "+389 70 123 456" }
POST  /api/v1/chat/conversations      { "agencyId": "…", "propertyId": "…", "bodyHtml": "<p>…</p>" }
```

An empty `phone` string clears the phone number. The API accepts `+`, digits, spaces, parentheses, and hyphens, with 6–20 characters and at least six digits.

### Participant endpoints

| Method and path | Request | Result used by mobile |
|---|---|---|
| `GET /context` | — | `{ emailVerified, messagingFlagged }` for a client. |
| `GET /unread` | — | `{ count }`: unread conversation count. |
| `GET /conversations?locale=&q=&limit=` | locale, optional search and limit | `{ items, hasMore }`. |
| `GET /conversations/lookup?agencyId=&propertyId=` | agency, optional property | `{ conversationId: string \| null }`. |
| `POST /conversations` | `agencyId`, optional `propertyId`, `bodyHtml` | `201 messageSent`, `{ conversationId, messageId, created }`. |
| `GET /conversations/:id?locale=` | locale | The full thread. |
| `POST /conversations/:id/messages` | `bodyHtml` | `201 messageSent`, `{ messageId }`. Keep an optimistic bubble, then refetch the thread. |
| `PATCH /conversations/:id/read` | — | `200`; mark as read after the thread becomes visible. |
| `POST /conversations/:id/block` | — | `{ blocked }`, the viewer's new blocked value. |
| `POST /conversations/:id/report` | optional `{ reason }` up to 500 characters | `201 reportSent`. |
| `POST /conversations/:id/remove` | — | `{ removed: true }`; remove only the local inbox row. |

### Response fields the UI relies on

Inbox items include `id`, `agency` and generic `counterpart` (`id`, `name`, optional `logoUrl`), optional `property` (`id`, localized `title`, optional `thumbnailUrl`), `lastMessage` (`preview`, `createdAt`, `isMine`), `unreadCount`, `closed`, and `blocked`.

A thread response provides the following top-level fields:

- `conversation`: `{ id, agencyId, propertyId, closedAt }`
- `counterpart`: `{ id, name, logoUrl, agencyInactive }`
- `property`: either `null` or `{ id, title, price, thumbnailUrl, available, href }`. When `available` is `false`, show the listing as unavailable and do not make it tappable.
- `messages`: ascending by `createdAt`. Every item has `id`, `kind` (`USER` or `SYSTEM`), `bodyHtml`, `bodyText`, `createdAt`, and viewer-relative `isMine`. A sender sees their own `status`; use `PENDING_REVIEW` to render “Awaiting review.” Messages awaiting review from the other participant are never exposed.
- `canReply`, `closed`, and `blockedState: { byMe, byOther }`. Use `blockedState` for the UI; the legacy `blocked` boolean means either side blocked the conversation.

Property titles and system-message text are already localized by the requested locale. User-written message text is never translated. Inbox previews are plain text, whitespace-normalized, and capped at roughly 140 characters.

The composer sends sanitized HTML. It may use `p`, `br`, `strong`/`b`, `em`/`i`, `ul`, `ol`, `li`, and links with `http`, `https`, `mailto`, or `tel` URLs. Render any other markup as plain text.

### Delivery and review states

- A normal delivered message can update the recipient's unread state and trigger a push.
- A message with `status: PENDING_REVIEW` is visible only to its sender. It creates no push notification.
- When an admin approves it, it becomes delivered and can trigger the normal recipient notification.
- System messages are informational only and never create a push notification.

## Prerequisites

- The Expo project has iOS and Android push credentials configured through EAS.
- The API deployment has `EXPO_ACCESS_TOKEN` configured as a **server-only** secret. It must never be included in the mobile app or an `EXPO_PUBLIC_*` variable.
- If Enhanced Push Security is enabled for the Expo project, the token must have permission to send push notifications for that project.
- Apply the migration `20260930090000_add_user_push_tokens` before deploying the API.

## API

Both endpoints require the normal authenticated Supabase bearer token. They are rooted at `/api/v1/users`.

### Register or refresh a device token

`POST /push-tokens`

```json
{
    "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "platform": "ios",
    "locale": "mk"
}
```

Accepted values:

- `platform`: `ios` or `android`
- `locale`: `mk`, `en`, `sq`, or `tr`

The response is `200` with the standard API envelope. The operation is idempotent: re-sending the same token refreshes its device metadata and associates it with the current user.

### Remove a device token

`DELETE /push-tokens/:token`

The token must be URL encoded because it contains brackets. A successful response is always `200`, including when the token was already removed.

Example:

```ts
await api.delete(`/api/v1/users/push-tokens/${encodeURIComponent(token)}`)
```

## Mobile responsibilities

1. Install `expo-notifications` with `npx expo install expo-notifications` and add the `expo-notifications` config plugin to the Expo app configuration. Rebuild the native app after adding or changing native notification configuration.
2. Use an EAS development or production build on a physical device to test remote push notifications. Android remote push notifications are unavailable in Expo Go from SDK 53 onward.
3. On Android, create the notification channel named `chat` **before** asking for permission or requesting a push token. It should use high importance and the default sound; this must match the backend payload's `channelId: "chat"`.
4. Configure `Notifications.setNotificationHandler` at application startup. Decide and document the foreground experience; for chat, show a banner/list and play sound only when the user is not already viewing that conversation.
5. After a user is authenticated, ask for notification permission. If it is denied, continue without registration and offer a settings link in the app's notification preferences. When granted, obtain the Expo token with the EAS `projectId` and call `POST /push-tokens`.
6. Register once on app launch, when the Expo token changes (`addPushTokenListener`), and whenever the app language changes. Do not register from render, from an effect with unstable dependencies, or from multiple screens. Keep an in-flight and successfully-submitted key (`userId`, token, platform, locale) in refs so duplicate renders do not create duplicate POSTs. Handle failures without blocking the app, and retry only on a later foreground, launch, token change, or locale change.
7. Call `DELETE /push-tokens/:token` on logout and when the user disables chat notifications. Do not send a token for an anonymous user.
8. Register a notification-response listener. A chat push contains:

```json
{
    "type": "chat_message",
    "conversationId": "<conversation id>",
    "url": "/conversation/<conversation id>"
}
```

When the user taps it, validate that `type` is `chat_message`, then navigate to that conversation. Also handle `getLastNotificationResponse()` so this works when the app was cold-started by the notification.
9. Treat a notification as a hint, not the source of truth: once opened, fetch the thread from the API. Do not place message content or authentication data in the navigation payload.

Minimal Expo configuration:

```json
{
    "expo": {
        "plugins": ["expo-notifications"]
    }
}
```

## Backend behavior

The API sends a best-effort Expo notification only after a user message has been committed as `DELIVERED`. Messages awaiting admin review do not trigger a push; if an admin approves one, delivery then triggers the push. Notification sending does not delay the message endpoint response.

The server includes the unread-conversation badge count, default sound, high priority, and the `chat` Android channel. Invalid Expo tokens reported as `DeviceNotRegistered` are removed automatically.

## Suggested mobile registration flow

```ts
const submitted = useRef(new Set<string>())
const pending = useRef(new Set<string>())

useEffect(() => {
    if (!userId || !accessToken) return

    let disposed = false

    const register = async () => {
        const token = (
            await Notifications.getExpoPushTokenAsync({
                projectId: Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId,
            })
        ).data
        const key = `${userId}:${token}:${Platform.OS}:${selectedLocale}`

        if (disposed || submitted.current.has(key) || pending.current.has(key)) return

        pending.current.add(key)
        try {
            await api.post("/api/v1/users/push-tokens", {
                token,
                platform: Platform.OS,
                locale: selectedLocale,
            })
            submitted.current.add(key)
        } finally {
            pending.current.delete(key)
        }
    }

    void register()
    return () => {
        disposed = true
    }
}, [userId, accessToken, selectedLocale])
```

Install a single `addPushTokenListener` at the authenticated app root, remove it in the effect cleanup, and pass its new token through the same de-duplicated submit function. The API client must attach the user's Supabase bearer token to both registration endpoints.
