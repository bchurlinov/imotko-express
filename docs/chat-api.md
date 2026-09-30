# Chat API

The Express API exposes the shared Imotko chat at `/api/v1/chat` and the moderation API at `/api/v1/admin/chat`. It uses the existing Supabase project and Prisma chat tables; the Next.js chat remains active and owns unread-reminder scheduling.

All responses have this envelope:

```json
{ "data": {}, "code": 200, "message": null }
```

Authenticated routes require `Authorization: Bearer <Supabase access token>`. Express validates that token with Supabase Auth and derives the database role and active agency membership itself. Request metadata can never grant a role.

## Participant routes

- `GET /conversations?q=&locale=mk&limit=30` lists the authenticated client or agency inbox.
- `GET /conversations/lookup?agencyId=&propertyId=` finds a client inquiry.
- `POST /conversations` starts or appends to an agency inquiry with `agencyId`, optional `propertyId`, and `bodyHtml`.
- `GET /conversations/:id?locale=mk` returns a thread.
- `POST /conversations/:id/messages` sends `{ "bodyHtml": "<p>Hello</p>" }`.
- `PATCH /conversations/:id/read`, `POST /conversations/:id/block`, `POST /conversations/:id/report`, and `POST /conversations/:id/remove` manage a thread.
- `GET /unread` and `GET /context` return inbox counts and verification/email-preference context.

Agency viewers can read; collaborators, agents, managers, and admins can send/block; managers and admins can remove agency-side threads. Removal affects only the remover’s inbox and preserves the other side’s history.

## Guest and admin routes

`POST /guest` accepts `name`, `email`, optional digits-only `phone`, `bodyHtml`, `agencyId`, optional `propertyId`, `locale`, `verificationChoice` (`verify` or `later`), and a honeypot `company`. A `verify` request creates the client database account and sends a Supabase magic link without creating a conversation. A `later` request creates a held message for admin review.

Admins use `/api/v1/admin/chat` for pending messages, filtered conversations, reports, approval/rejection, closures, report resolution, and user messaging flags. Moderation delivery uses a conditional update on `PENDING_REVIEW`, so simultaneous Next and Express actions produce one delivery side effect.

## Ownership rules

Only a user (or a database-admin) may update/delete that user or list/mutate that user’s notifications. Notification status and deletion queries are scoped by `recipientId`. User deletion derives the Supabase identity from the authenticated request, never from a request-body session id; it retains chat history, adds a system event, closes conversations, and notifies counterparts.
