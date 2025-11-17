# Supabase Auth Integration Plan

## Objective & Scope
- Enable a single Supabase project to govern authentication for both the React Native client and this Express.js API.
- Ensure any access token issued by Supabase Auth can be presented to Express as a Bearer token and validated server-side before invoking domain services.
- Preserve the documented layering from `docs/folder_structure.md` (`routes` → `controllers` → `services` → `repositories` → `models`) by centralizing Supabase logic inside shared config/util modules and versioned middlewares rather than scattering SDK calls across the stack.

## Supabase Studio Configuration & Keys
All keys are in **Project Settings → API** unless noted. Mirror them into `.env`, `.env.example`, and React Native secrets as appropriate.

| Env Var | Source | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Project URL | Base URL used by both apps when instantiating `createClient`. |
| `SUPABASE_ANON_KEY` (aka publishable key) | Project API keys | Safe for client usage; lets React Native perform sign-in/sign-up flows. |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API keys | **Server-only** key for privileged actions (verifying tokens, admin calls). Never ship to the client. |
| `SUPABASE_JWT_SECRET` | Project Settings → Auth → JWT | Used only if we need to mint custom roles or self-verify HS256 tokens without JWKS. Keep on the server. |
| `SUPABASE_JWKS_URL` | Derived: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` | URL the Express middleware will hit (via `jose.createRemoteJWKSet`) to validate JWT signatures offline. |

## Implementation Steps

1. **Create shared config (aligned with `src/config/`)**
   - Add `src/config/supabase.ts` that reads env keys, validates them on startup, and exports typed accessors so other modules cannot accidentally read undefined credentials.
   - Surface the same constants through `src/config/index.ts` if that file aggregates configs per `docs/folder_structure.md`.
   - Document required env keys inside `.env.example` (root) and cross-link to a short note inside `docs/api/` or `docs/architecture/` describing environment expectations.

2. **React Native client setup**
   - Install `@supabase/supabase-js` and `@react-native-async-storage/async-storage`.
   - Create `lib/supabase.ts` in the RN app using `createClient` with `AsyncStorage`, `autoRefreshToken`, and `persistSession` (per Supabase RN quickstart).
   - Build auth UI/hooks (sign in/up, password reset) that store the returned `session`.
   - **API calls to Express**: whenever the RN app talks to Express, include `Authorization: Bearer <session.access_token>` and optionally `x-supabase-refresh: <session.refresh_token>` for proactive refresh flows.

3. **Express Supabase helper (`src/utils/`)**
   - Add `src/utils/supabaseClient.ts` (or `.js` depending on current code style) that exports:
     ```ts
     import { createClient } from "@supabase/supabase-js"
     export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
     ```
   - Provide a `createRequestScopedClient(req, res)` using `@supabase/ssr` to manage cookies when handling magic-links or OAuth callbacks (matches the Express example from Supabase docs). Export this helper from the `utils/` barrel if one exists.
   - If background jobs or integrations will talk to Supabase, re-use this utility inside `jobs/` or `integrations/` folders per the documented structure.

4. **JWT verification middleware (`src/api/v1/middlewares/`)**
   - Implement `verifySupabaseToken` under `src/api/v1/middlewares/` so each API version can opt into Supabase independently.
     - Extract the `Authorization` header.
     - Validate signature via `jose.createRemoteJWKSet(new URL(SUPABASE_JWKS_URL))` + `jwtVerify`. (Supabase docs recommend JWKS for modern projects, with `/auth/v1/user` fallback for legacy HS256 tokens.)
     - Optionally double-check the user via `supabaseAdmin.auth.getUser(access_token)` if we need fresh profile metadata or to ensure the account still exists.
     - Attach the decoded JWT claims (user id, role, exp) to `req.user` for downstream controllers.
   - Return 401 on missing/invalid tokens and 403 if role constraints fail.
   - Extend `src/types/express.d.ts` (per folder structure) so TypeScript-aware modules see the Supabase user shape on `req.user`.

5. **Route protection (`src/api/v1/routes/` & `src/app.ts`)**
   - Register the middleware within the v1 router entry point (e.g., `src/api/v1/routes/index.ts`) or at the `src/app.ts` level via `app.use("/api/v1", verifySupabaseToken, apiV1Router)` to keep public routes (health, webhooks) outside the guard.
   - Controller modules in `src/api/v1/controllers/` should trust `req.user` instead of re-reading headers to stay consistent with the layered architecture.
   - When future versions (`src/api/v2/`) emerge, gate them behind the same middleware or an extended variant to prevent drift.

6. **Session management endpoints (optional)**
   - Expose `/auth/callback` and `/auth/confirm` endpoints within `src/api/v1/controllers/auth.controller.ts` & `src/api/v1/routes/auth.routes.ts` that wrap `supabase.auth.exchangeCodeForSession` and `supabase.auth.verifyOtp`, respectively, mirroring the official Express snippets. These ensure email OTP/magic-link flows handled in mobile have server parity if ever used in the backend.
   - Keep shared validation logic under `src/api/v1/validators/auth.validator.ts` to stay aligned with the folder layout.

7. **React Native ↔ Express workflow**
   1. RN user signs in via Supabase → receives `{ access_token, refresh_token }`.
   2. RN persists session locally; attaches `Authorization` header on every Express request.
   3. Express middleware validates JWT signature using JWKS, optionally confirms user exists via `supabaseAdmin.auth.getUser`.
   4. On success, Express controllers execute business logic and respond. On refresh expiration, RN listens to `onAuthStateChange` and re-authenticates, reusing the shared Supabase project.

8. **Testing strategy (mirrors `tests/` tree)**
   - RN manual QA: run Supabase login, confirm tokens stored, make `fetch` to Express endpoint and expect success.
   - Backend manual tests (document in PR and/or add targeted specs under `tests/integration/api/`):
     - `curl` with a valid token (obtain from RN or `supabase.auth.signInWithPassword` script) → expect 200.
     - `curl` with expired/forged token → expect 401 due to JWKS verification.
     - `curl` with valid token but unauthorized role (if applicable) → expect 403.
   - Optional: add a lightweight unit spec for the middleware under `tests/unit/middlewares/verifySupabaseToken.spec.ts` once the testing harness for TS/JS files is clarified.

9. **Future enhancements**
   - Cache JWKS with `jose` built-in caching for fewer network trips.
   - Add role-based access middleware that reads `req.user.app_metadata` to enforce RBAC.
   - Provide webhook handler listening to Supabase Auth events (via `auth.v1.admin`) to sync user metadata into local tables if needed.

## Seamless Communication Notes
- **Single source of truth**: Only Supabase issues credentials. Express trusts Supabase by validating JWTs; React Native never re-authenticates with Express directly.
- **Token refresh**: RN auto-refresh keeps the `access_token` current; Express statelessly verifies any presented token, so no server session store is required.
- **Error propagation**: Express returns 401/403 JSON with clear codes so the RN app can trigger `supabase.auth.signOut()` or show UI prompts.
- **Environment parity**: Staging/production Express instances should point to matching Supabase projects to avoid cross-project token rejections. Mirror the mapping in `docs/architecture/` so it stays near the folder-structure documentation.

Once this plan is approved, the next steps are to scaffold the helpers/middlewares, wire them into the existing Express modules, and update both `.env` files and RN secrets accordingly.
