# Mobile handoff: hide removed chat conversations immediately

**Target repository:** `../imotko-mobile`

**Backend dependency:** `20261004120000_conversation_participant_removed` and the accompanying Express changes in `imotko-express`.

**Goal:** After a client removes a conversation, the mobile app must stop showing it immediately and must never restore it from a stale TanStack Query cache, background refetch, old push notification, or navigation history.

## Why a mobile change is needed

Express is now authoritative about removal:

- `ConversationParticipant.removed` is set only for the side that removes the conversation.
- The remover's inbox, unread count, push badge, and thread endpoint all exclude that conversation.
- The other side still sees the conversation and the removal SYSTEM message.

The current mobile `useRemoveConversation()` implementation only invalidates queries after the request succeeds. It does not perform the optimistic inbox removal described by the mobile chat design. This leaves several client-side races:

1. The old row remains visible until the refetch completes.
2. An inbox request already in flight can restore stale data after removal.
3. Separate locale, search, and page-limit inbox cache entries can retain the row.
4. An old thread cache, navigation entry, or push notification can reopen a conversation that now returns `404 conversationNotFound`.

The mobile app should fix those cache and navigation behaviors. It must not reproduce the database flag as local business logic.

## Backend contract

No API response shape changes are required in mobile normalizers.

| Request                                             | Contract after removal by the authenticated client                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `POST /api/v1/chat/conversations/:id/remove`        | Idempotent `200` with `{ "data": { "removed": true }, "code": 200, "message": null }` |
| `GET /api/v1/chat/conversations`                    | The removed conversation is absent for that client                                    |
| `GET /api/v1/chat/unread`                           | The removed conversation is excluded from the count                                   |
| `GET /api/v1/chat/conversations/:id`                | `404 conversationNotFound` for the remover                                            |
| Same inbox/thread requests as the other participant | Conversation remains visible, including the removal SYSTEM line                       |
| Push badge calculation                              | Removed conversations are excluded                                                    |

Important details:

- Inbox items and thread responses do **not** expose `ConversationParticipant.removed`.
- Mobile must not look for a `removed` property in `normalizeInboxItem()` or `normalizeThread()`.
- `404 conversationNotFound` is the authoritative response for a removed thread, deliberately indistinguishable from a missing or inaccessible conversation.
- The unread endpoint counts conversations with unread messages, not individual unread messages. Removing one row with `unreadCount > 0` reduces the optimistic badge by exactly **one**.

## Required mobile changes

### 1. Add pure cache-response helpers

Create `utils/chat/chat_cache.js` or equivalent pure helpers. Keep them independent of React Native and `@/` aliases so they can be checked directly with Node.

The inbox query cache contains the raw Express envelope returned by `request()`, before the query's `select` normalizer:

```js
{
    data: {
        items: [{ id: "conversation-id", unreadCount: 2 }],
        hasMore: false,
    },
    code: 200,
    message: null,
}
```

Add a helper that immutably removes an ID from that shape:

```js
export const removeConversationFromInboxResponse = (response, conversationId) => {
    const items = response?.data?.items
    if (!Array.isArray(items)) return response

    const nextItems = items.filter(item => String(item.id ?? item.conversationId) !== String(conversationId))
    if (nextItems.length === items.length) return response

    return {
        ...response,
        data: { ...response.data, items: nextItems },
    }
}
```

Also add a helper that returns the matching raw inbox item from a collection of cached inbox responses. It is used to determine whether the unread-conversation badge should be decremented.

### 2. Make `useRemoveConversation()` race-safe and optimistic

Modify `queries/chat/chat.js`.

In `onMutate({ conversationId })`:

1. Cancel all inbox requests under `chatKeys.inboxAll(user.id)`. This prevents an older response from overwriting the optimistic removal.
2. Cancel the unread request and the target thread requests.
3. Snapshot every inbox cache entry with `queryClient.getQueriesData({ queryKey: chatKeys.inboxAll(user.id) })`.
4. Snapshot the unread response.
5. Find the removed row in any inbox snapshot.
6. Use `queryClient.setQueriesData()` to remove the conversation from **all** cached inbox variants. This includes every locale, search string, and limit.
7. If the removed row had `unreadCount > 0`, optimistically decrement `response.data.count` in the unread cache by one, clamped at zero.
8. Return the snapshots from `onMutate` for rollback.

Illustrative mutation structure:

```js
export const useRemoveConversation = () => {
    const queryClient = useQueryClient()
    const { user } = useAuth()

    return useMutation({
        mutationFn: async ({ conversationId }) =>
            unwrap(await axios.post(`chat/conversations/${conversationId}/remove`)),

        onMutate: async ({ conversationId }) => {
            const inboxKey = chatKeys.inboxAll(user?.id)
            const unreadKey = chatKeys.unread(user?.id)
            const threadKey = chatKeys.threadAll(user?.id, conversationId)

            await Promise.all([
                queryClient.cancelQueries({ queryKey: inboxKey }),
                queryClient.cancelQueries({ queryKey: unreadKey }),
                queryClient.cancelQueries({ queryKey: threadKey }),
            ])

            const inboxSnapshots = queryClient.getQueriesData({ queryKey: inboxKey })
            const unreadSnapshot = queryClient.getQueryData(unreadKey)
            const removedItem = findConversationInInboxSnapshots(inboxSnapshots, conversationId)

            queryClient.setQueriesData({ queryKey: inboxKey }, response =>
                removeConversationFromInboxResponse(response, conversationId)
            )

            if (Number(removedItem?.unreadCount) > 0) {
                queryClient.setQueryData(unreadKey, response =>
                    response?.data
                        ? {
                              ...response,
                              data: {
                                  ...response.data,
                                  count: Math.max(0, (Number(response.data.count) || 0) - 1),
                              },
                          }
                        : response
                )
            }

            return { inboxSnapshots, unreadSnapshot }
        },

        onError: (_error, _variables, context) => {
            context?.inboxSnapshots?.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data)
            })
            queryClient.setQueryData(chatKeys.unread(user?.id), context?.unreadSnapshot)
        },

        onSuccess: (_result, { conversationId }) => {
            queryClient.removeQueries({ queryKey: chatKeys.threadAll(user?.id, conversationId) })
            queryClient.removeQueries({ queryKey: chatKeys.lookupAll(user?.id) })
        },

        onSettled: () =>
            Promise.all([
                queryClient.invalidateQueries({ queryKey: chatKeys.inboxAll(user?.id) }),
                queryClient.invalidateQueries({ queryKey: chatKeys.unread(user?.id) }),
            ]),
    })
}
```

Treat this as a shape-accurate sketch, not a reason to duplicate helpers inline. Keep the immutable response transformations in the pure cache utility.

Why each operation matters:

- `cancelQueries` protects the optimistic state from stale in-flight responses.
- `setQueriesData` updates all locale/search/limit variants, not only the currently visible list.
- rollback restores the row if the server rejects the operation or the network fails.
- final invalidation reconciles the optimistic state with the authoritative server state.
- removing lookup caches prevents a 30-second cached lookup from reopening the old ID when the client starts a new inquiry with the same agency/property.

### 3. Keep removal navigation server-confirmed

The current navigation behavior in `components/screens/messages/conversation_actions_sheet.jsx` is correct in principle:

- Do not leave the thread until the remove request succeeds.
- On success, dismiss the actions sheet and thread so the Messages inbox is visible.
- On failure, stay in place and show `getChatErrorMessage(error, t)`.

The inbox removal path in `components/screens/messages/inbox_screen.jsx` must also provide `onError: showError`; it currently records success but can fail silently.

Disable both remove entry points while `removeConversation.isPending` so repeated taps do not enqueue duplicate requests. The backend is idempotent, but the UI should still submit once.

### 4. Evict stale thread routes on `404 conversationNotFound`

Modify `components/screens/messages/thread_screen.jsx` so a stale back-stack entry, deep link, or old push cannot keep a removed thread visible.

When `useConversation(conversationId)` returns `404 conversationNotFound`:

1. Cancel and remove `chatKeys.threadAll(user.id, conversationId)` after leaving the route.
2. Reconcile the inbox and unread queries.
3. Replace or dismiss the route to `Routes.MESSAGES`.
4. Do not render cached message content while redirecting.

The existing unavailable state may be retained as a fallback for navigation failure, but removed thread content must never be rendered after the 404 is known.

This also handles a push notification delivered before removal but opened afterward. The push remains a navigation hint; the thread endpoint decides whether the user can still access it.

### 5. Do not add client-side participant-flag filtering

No change is needed in `utils/chat/chat_normalizers.js` for a `removed` field. Filtering on the database flag belongs to Express because:

- the flag is participant-specific;
- the API already returns only the viewer's allowed rows;
- older mobile versions remain compatible;
- exposing internal participant rows would expand the API contract unnecessarily.

## Verification

### Pure cache checks

Verify the cache helpers with raw API envelopes:

1. Removes a matching `id`.
2. Supports the legacy fallback `conversationId` key.
3. Leaves unrelated rows and envelope fields unchanged.
4. Returns the original object when no row matches.
5. Handles `null`, missing `data`, and missing `items` without throwing.
6. Locates the row across multiple cached locale/search/limit responses.

### Mutation checks

Using a fresh `QueryClient`, seed at least three inbox keys:

- default inbox;
- searched inbox;
- a larger page limit or different locale.

Then verify:

1. `onMutate` removes the ID from all three caches immediately.
2. A removed unread conversation decrements the unread-conversation count by one, not by its message count.
3. A read conversation does not change the unread count.
4. A failed request restores every inbox snapshot and the unread snapshot.
5. A successful request clears the target thread and stale lookup caches.
6. Settling the mutation invalidates inbox and unread queries.

### Manual iOS and Android flow

1. Open an inbox containing a conversation and start a pull-to-refresh.
2. Remove that conversation before the refresh completes.
3. Confirm the row disappears immediately and does not flash back.
4. Repeat from a searched inbox and after loading more than 30 rows.
5. Remove an unread conversation and confirm the tab badge decreases by one.
6. Remove from inside the thread and confirm the app returns to Messages without the row.
7. Simulate an offline/server failure and confirm the row is restored and an error is shown.
8. Open an old push/deep link for the removed ID and confirm the app returns to Messages without rendering the thread.
9. Restart the app and confirm the conversation remains absent.
10. Confirm through the agency/web side that the other participant still sees the conversation and removal SYSTEM message.

Run `pnpm lint` before handoff and test both iOS and Android navigation behavior.

## Rollout

Deploy the Express migration and flag-based API before relying on the new behavior in mobile. The mobile cache hardening is backward-compatible with the previous API response shapes, so it may be released independently after the backend is available.

No mobile database migration, new environment variable, API field, or localization key is required.
