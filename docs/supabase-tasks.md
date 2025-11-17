Please# Supabase Backend Implementation Tasks

## Phase 1 – Environment & Config Foundations
- [x] Confirm Supabase project credentials exist and add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, and `SUPABASE_JWKS_URL` to `.env` / `.env.example`.
- [x] Create `docs/.env.example` delta note describing new keys and their purpose (cross-reference `Supabase Studio Configuration & Keys` in `docs/supabase-auth-plan.md`).
- [x] Decide whether all environments (dev/staging/prod) share one Supabase project or need per-env projects; document mapping in `docs/`.

## Phase 2 – Shared Supabase Utilities
- [x] Add `src/config/supabase.ts` to expose validated env accessors (throw descriptive errors when a key is missing).
- [x] Create `src/utils/supabaseClient.ts` instantiating `supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` and exporting helpers for request-scoped clients if future flows need cookie/session support.
- [x] Ensure utilities are tree-shake friendly (no work at import time beyond client creation) and covered by light unit tests or manual notes. (Manual note: env accessors throw synchronously and client factories only instantiate Supabase SDKs.)

## Phase 3 – Express Middleware & Wiring
- [x] Implement `src/api/v1/middlewares/verifySupabaseToken.ts` using `jose.createRemoteJWKSet(new URL(SUPABASE_JWKS_URL))` + `jwtVerify` to validate Bearer tokens.
- [x] Normalize 401/403 responses inside the middleware (missing token, invalid signature, insufficient role) and attach decoded claims to `req.user`.
- [x] Register the middleware across protected route groups (keep health/webhook routes public per existing routing strategy). _(Currently applied to the `/api/v1/properties` routes for initial verification; extend to remaining protected groups once Supabase auth is ready to roll out broadly.)_
- [ ] Optionally add `/auth/callback` and `/auth/confirm` controllers if magic link/OAuth parity with React Native is required (mark as stretch goals).

## Phase 4 – Testing & Verification
- [x] Script manual token acquisition (see `scripts/provisionSupabaseUser.js`) to simplify testing without the RN client.
- [ ] Curl protected endpoints with valid/invalid/expired tokens and log results in PR description as required by project testing guidelines.
- [ ] Capture follow-up tasks (e.g., RBAC middleware, JWKS caching, Supabase webhook consumers) for future backlog if they stay out of scope.
