# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Express.js REST API backend for a property management platform (Imotko). It uses JavaScript with JSDoc for type annotations, Prisma ORM with PostgreSQL, and integrates with Supabase for authentication and database hosting.

## Development Commands

### Running
- `npm run dev` - Start development server with hot reload (uses nodemon)
- `npm start` - Run production server

### Database (Prisma)
- `npx prisma migrate dev` - Run migrations in development
- `npx prisma generate` - Generate Prisma client (required after schema changes)
- `npx prisma studio` - Open Prisma Studio GUI
- `npx prisma db push --force-reset` - Reset database (WARNING: destructive)
- `npx prisma migrate dev --create-only` - Create migration without applying
- `npx prisma migrate status` - Check migration status
- `npx prisma migrate resolve --applied "migration_name"` - Mark migration as applied

### Formatting
- `npx prettier --write .` - Format code

## Architecture

### Project Structure
```
src/
├── api/v1/                    # API version 1
│   ├── controllers/           # Request handlers
│   ├── middlewares/           # Express middlewares
│   ├── routes/                # Route definitions
│   └── services/              # Business logic layer
├── config/                    # Configuration files
├── database/                  # Database client setup
├── generated/prisma/          # Auto-generated Prisma client
├── modules/                   # Reusable modules (e.g., email)
├── types/                     # JSDoc type definitions (.d.ts files)
└── utils/                     # Utility functions

prisma/
├── schema/                    # Split Prisma schemas
│   ├── user.prisma
│   ├── property.prisma
│   ├── agency.prisma
│   ├── client.prisma
│   ├── proposal.prisma
│   └── misc.prisma
└── schema.prisma              # Main schema file
```

### Authentication Architecture

The application supports **dual authentication systems**:

1. **Custom JWT Authentication** (legacy/traditional)
   - Access tokens (15 min expiry) + Refresh tokens (60 min expiry)
   - Refresh tokens stored in httpOnly cookies
   - Middleware: `verifyJWT` (src/api/v1/middlewares/verifyJWT.js:6)
   - Token generation: `generateTokens()` (src/utils/auth/tokens.js:10)
   - Environment variables: `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`

2. **Supabase Authentication** (primary)
   - JWT verification using JWKS (JSON Web Key Set) with HS256 fallback
   - Middleware: `verifySupabaseToken` (src/api/v1/middlewares/verifySupabaseToken.js)
   - Token verification logic in src/api/v1/middlewares/verifySupabaseToken.js
   - Environment variables: `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_JWKS_URL`

**When adding new protected routes**, use `verifySupabaseToken` middleware for new features, as it's the primary authentication method.

### Route Organization

Routes are organized by version and resource:
- Main router initialization: src/api/v1/routes/index.js
- Route structure: `/api/v1/{resource}`
  - `/api/v1/auth` - Authentication endpoints (login, register, logout, refresh)
  - `/api/v1/properties` - Property management
  - `/api/v1/users` - User management

### Path Aliases

JavaScript path mappings are configured in jsconfig.json:
- `@/*` → `src/*`
- `@controllers/*` → `src/api/v1/controllers/*`
- `@middlewares/*` → `src/api/v1/middlewares/*`
- `@routes/*` → `src/api/v1/routes/*`
- `@services/*` → `src/api/v1/services/*`
- `@generated/prisma` → `src/generated/prisma/index.js`

**Always use these aliases** instead of relative paths for cleaner imports.

### Prisma Configuration

- **Output location**: Prisma client is generated to `src/generated/prisma/` (not default `node_modules`)
- **Schema split**: Database schema is split across multiple files in `prisma/schema/`
- **Import pattern**: `import { PrismaClient } from "@generated/prisma"`
- **Global client**: Use the singleton client from `src/database/client.js` (includes default omit configuration for sensitive fields)
- **Features enabled**: `fullTextSearchPostgres`, `relationJoins`

### Validation Pattern

Request validation uses `express-validator`:
1. Define validation rules in route definitions (see src/api/v1/routes/auth/auth.routes.js)
2. Check validation in controllers using `validationResult(req)` (see src/api/v1/controllers/user/auth/auth.controller.js)
3. Alternative: Use `validateRequest` middleware (src/api/v1/middlewares/validate_request.js)

### Error Handling

- Central error middleware: src/api/v1/middlewares/errorMiddleware.js
- Use `http-errors` package: `import createError from "http-errors"`
- Pass errors to `next()` middleware in async functions
- Morgan logger configured for development mode

### Security Middleware Stack (in order)

1. `credentials` - CORS credentials handling (src/api/v1/middlewares/credentials.js)
2. `rateLimit` - 100 requests per 15 minutes
3. `helmet()` - Security headers
4. `cors()` - CORS configuration
5. Cookie parser with JWT secret

## Environment Configuration

Required environment variables (see .env.example for full list):
- `DATABASE_URL` - PostgreSQL connection string
- `DIRECT_URL` - Direct database connection (for Supabase)
- `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` - JWT secrets (legacy auth)
- `SUPABASE_URL` / `SUPABASE_JWT_SECRET` / `SUPABASE_JWKS_URL` - Supabase config
- `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` - Supabase keys
- `AWS_SES_KEY` / `AWS_SES_SECRET_KEY` / `AWS_SES_REGION` - Email service
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 5050)

## Important Notes

### User Data Privacy
The Prisma client is configured to automatically omit sensitive fields (src/database/client.js):
- `user.refreshToken`
- `user.accessToken`
- `user.ipAddress`

When querying users, these fields are excluded by default. Use raw queries or explicit includes if needed.

### Module System
- Project uses ES modules (`"type": "module"` in package.json)
- All imports must include `.js` extension (ESM convention)
- Example: `import x from "./file.js"` (not `"./file"`)

### Type Safety with JSDoc
- The project uses JSDoc comments for type annotations
- Type checking is enabled via `jsconfig.json` with `"checkJs": true`
- Use JSDoc syntax for type annotations:
  - `@param {import('express').Request} req` - for Express types
  - `@param {import('@prisma/client').User} user` - for Prisma types
  - `@returns {Promise<void>}` - for return types
  - `@typedef` - for custom type definitions
- Editors like VS Code provide IntelliSense and type checking with JSDoc

### Email Integration
Email transporter module in src/modules/email_transporter/ - check this module when implementing email features.

### Kill Process
To kill the server on port 5050: `kill -9 $(lsof -ti:5050)` (noted in src/app.js:57)
