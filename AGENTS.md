# Repository Guidelines

## Project Overview
Imotko Express is an Express.js REST API for a property platform. The codebase is JavaScript-first, uses ES modules, relies on JSDoc and `.d.ts` files for editor type support, and uses Prisma with PostgreSQL. Supabase is the primary authentication provider, while some legacy JWT middleware still exists for older flows.

## Project Structure & Module Organization
`src/app.js` is the runtime entrypoint and wires middleware, routes, shutdown handling, scheduled jobs, and Prisma cleanup. API code lives under `src/api/v1/` with `controllers/`, `middlewares/`, `routes/`, and `services/`. Shared configuration lives in `src/config/`, Prisma access in `src/database/`, reusable helpers in `src/utils/`, dictionary data in `src/dictionaries/`, scheduled/import jobs in `src/jobs/`, feature modules in `src/modules/`, and request/Express typing support in `src/types/`. Email templates and message assets live in `src/messages/`, logs may appear in `src/logs/` and `src/api/v1/logs/`, Prisma schemas live in `prisma/schema/`, migrations in `prisma/migrations/`, and the generated Prisma client is emitted to `generated/prisma/`.

## Build, Run, and Database Commands
- `pnpm dev` - start the development server with `.env.development` and Nodemon
- `pnpm stage` - start Nodemon with `.env.stage`
- `pnpm prod` - start Nodemon with `.env.production`
- `pnpm start` - run the app directly with the current shell environment
- `pnpm start:dev` / `pnpm start:stage` / `pnpm start:prod` - run the app directly against a specific env file
- `pnpm prisma generate` - regenerate the Prisma client into `generated/prisma/`
- `pnpm prisma migrate dev` - create/apply development migrations
- `pnpm prisma studio` - inspect local data in Prisma Studio
- `pnpm exec prettier --write .` - format the repository

There is currently no TypeScript compile step and no `dist/` output. The runtime uses Node ESM and `--experimental-transform-types`, so do not add docs that assume a `tsc` build pipeline.

## Architecture Notes
Routes are mounted from `src/api/v1/routes/index.js` under `/api/v1`. Current top-level resources are `/properties`, `/users`, `/agencies`, `/analytics`, and `/website`.

Use the controller/service split consistently: routes define validation and middleware, controllers handle request/response orchestration, and services own database access and business logic.

Authentication is dual-mode:
- `verifySupabaseToken` in `src/api/v1/middlewares/verifySupabaseToken.js` is the default for new protected endpoints
- `verifyJWT` in `src/api/v1/middlewares/verifyJWT.js` exists for legacy token flows

Validation uses `express-validator` in routes plus `validateRequest` middleware. Errors should flow through `http-errors` and `errorMiddleware`.

`src/app.js` currently applies middleware in this order: `morgan`, `credentials`, production-only rate limiting, `helmet`, `cors`, `express.json`, `cookieParser`, routes, then `errorMiddleware`.

## Prisma & Database Conventions
Prisma configuration is driven by `prisma.config.js`, uses the split schema directory at `prisma/`, and reads `DIRECT_URL` for migrations. The application Prisma client is created in `src/database/client.js` using the generated client from `#generated/prisma/client.ts` and the `@prisma/adapter-pg` adapter.

Sensitive user fields are omitted by default in the shared Prisma client:
- `accessToken`
- `refreshToken`
- `ipAddress`

Prefer the shared Prisma singleton over ad hoc client instantiation.

## Imports, Style, and Naming
The project uses package import aliases from `package.json`, not `jsconfig.json`. Prefer these aliases over deep relative imports:
- `#controllers/*`
- `#middlewares/*`
- `#routes/*`
- `#services/*`
- `#utils/*`
- `#database/*`
- `#config/*`
- `#dictionaries/*`
- `#types/*`
- `#generated/*`
- `#supabase`

Follow the existing ESM style:
- include `.js` extensions on local imports unless the alias target is intentionally typed/generated otherwise
- keep code in JavaScript with JSDoc where extra type clarity is useful
- use `camelCase` for variables/functions and `PascalCase` for constructor-style types or classes
- prefer concise controllers and keep data logic in services

Prettier is the source of truth: 4 spaces, double quotes, no semicolons, trailing commas where supported by Prettier, 120 character line width.

## Testing & Verification
Automated coverage is still light. Nodemon ignores `src/**/*.spec.js`, so place new specs alongside the code they cover and run them directly with `pnpm exec tsx path/to/file.spec.js` when needed.

Every non-trivial change should include:
- at least one happy-path verification
- at least one failure-path or permission-path verification
- any manual API checks you ran, such as `curl` requests against `/api/v1/...`

If a change touches Prisma schema, generate the client and note whether a migration was created or expected.

## Environment & Security
Read secrets from `.env`, and keep `.env.example` updated when adding new required keys. Common environment variables in active use include:
- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_JWKS_URL`
- `AWS_SES_KEY`
- `AWS_SES_SECRET_KEY`
- `AWS_SES_REGION`
- `OPENAI_API_KEY`
- `CRON_SECRET`
- `IMPORT_*` job settings
- `CACHE_*` settings
- `PORT`
- `ENV`

Do not commit credentials, avoid logging tokens or sensitive payloads, and prefer updating shared middleware or shared utilities instead of duplicating auth, referer checks, rate limits, or validation logic inside controllers.

## Commit & Pull Request Guidelines
Keep commit subjects short and imperative, matching existing history such as `include externalId` or `fix issue with analytics.service.js`. Use a subsystem prefix when it adds clarity, for example `users: tighten Supabase sync`.

Before opening a PR:
- format touched files
- run the relevant app command or manual verification flow
- run Prisma generate/migrations if schema changed
- summarize any new env vars, migration impact, or API contract changes
