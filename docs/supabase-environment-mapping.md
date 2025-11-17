# Supabase Environment Mapping

We will treat the existing Supabase project (`fztyilnlnircvjhsfoyu`) as a shared sandbox for development and staging to keep RN + Express integration unblocked. Production will run on a separate Supabase project so customer data never mingles with test fixtures.

| Environment | Supabase project ref | Notes |
| --- | --- | --- |
| Development | `fztyilnlnircvjhsfoyu` | Matches the credentials currently stored in `.env`; use these when running `pnpm dev`. |
| Staging | `fztyilnlnircvjhsfoyu` | Reuse the same project until a staging clone is requested; staging deployments should load the same keys from their host. |
| Production | `imotko-prod` (TBD) | Create a dedicated project before go-live. Copy Auth settings from the shared project, then rotate the keys referenced in `.env.production`. |

Action items when the production project is provisioned:
1. Export the Auth configuration from Supabase Studio and import it into the new project to replicate providers/JWT settings.
2. Update deployment secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_JWKS_URL`) to point to the production project.
3. Document the new project ref in this file so infra scripts stay accurate.
