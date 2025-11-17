# Repository Guidelines

## Project Structure & Module Organization
`src/app.ts` bootstraps middleware, JWT guards, and the Express server. HTTP concerns stay in `routes/` and `controllers/`, domain logic in `services/` or feature `modules/`, and shared helpers in `utils/`. Persisted assets sit in `messages/` and `logs/`, while Prisma lives under `prisma/` (`schema/`, `migrations/`, `prisma.ts`). Common type extensions belong in `types.d.ts`, drafts in `docs/`, and build artifacts appear in `dist/` after `pnpm build`. See `docs/folder_structure.md` for the complete enterprise layout.

## Build, Test, and Development Commands
- `pnpm dev` – Nodemon watches `src/**/*.ts` and re-runs `tsx --inspect src/app.ts` for hot reload.
- `pnpm build` – compiles TypeScript with `tsc`, emitting to `dist/`.
- `pnpm start` – rebuilds then runs `node dist/app.js` (use for staging/production parity).
- `pnpm prisma migrate dev` / `pnpm prisma generate` – apply schema changes and refresh the Prisma client before coding against new tables.

## Coding Style & Naming Conventions
Prettier (`.prettierrc`) dictates 4-space indentation, double quotes, no semicolons, trailing commas, and a 120-character width; run it before every commit. Use `camelCase` for variables and functions, `PascalCase` for classes or modules, and `UPPER_SNAKE_CASE` for environment keys consumed via `process.env`. Order imports from Node built-ins to npm packages to local alias paths (`#routes`, `#middlewares`, etc.), and ensure controllers only orchestrate services while errors are routed through `errorMiddleware`.

## Testing Guidelines
Automated coverage is thin, but Nodemon already ignores `src/**/*.spec.ts`, so place new specs alongside the files they verify (`auth.controller.spec.ts`, `user.service.spec.ts`). Until a universal runner is added, execute focused specs via `pnpm exec tsx path/to/spec.ts` and document the manual verification you performed (for example, `curl http://localhost:5050/api/users -H "Authorization: Bearer <token>"`). Every logic change must document the happy-path and failure-path checks you ran.

## Commit & Pull Request Guidelines
Follow the existing history of concise, imperative commit subjects (e.g., `improve register route, add nodemailer`). Reference the subsystem when it clarifies intent (`auth: tighten password hashing`). Before opening a PR, ensure `pnpm build` succeeds, summarize changes, link issues, attach screenshots or sample payloads for user-facing work, and call out schema or `.env` updates so reviewers know how to reproduce your test plan.

## Security & Configuration Tips
Read secrets from `.env` (mirror them in `.env.example`), never commit credentials in services or Prisma helpers, and update shared middleware like `credentials` or `verifyJWT` instead of sprinkling ad-hoc guards through routes. New integrations should document required environment keys in `docs/` and avoid logging sensitive payloads.
