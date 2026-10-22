# Global rate limit: how to turn it on

## Why it was off

The global limiter (100 requests / 15 min per IP, 500 per signed-in user) used to run only when `ENV=production`.
`ENV` was never set on Railway or the Dokploy VPS, so production has had no global limit.

Setting `ENV=production` alone would have broken things: imotko (web) and imotko-templates call Express from the
server, from a few shared Vercel IPs, on behalf of every visitor. All of them would share one 100-request bucket and
get 429s within minutes.

## What changed

- The switch is now `RATE_LIMIT_ENABLED=true` (exact value). `ENV` no longer affects it. Unset = off, as today.
- Our own servers send `X-Imotko-Internal-Secret: <INTERNAL_API_SECRET>`. Express compares it in constant time; a
  match skips the global limiter. Unset secret on Express = nobody is trusted.
- Mobile apps and browsers are unchanged: signed-in requests are counted per Supabase user id, anonymous ones per IP
  (IPv6 per /64).
- The header is sent only to Express, never to agency domains.

Why skip instead of counting per end-user IP: almost every web/templates call is a shared cached read
(`"use cache: remote"`, `next.revalidate`), made once for many visitors, so there is no single visitor to count.
Visitors hitting the web/templates sites are limited by Vercel, not by Express.

Callers that send the header:

| App | File |
| --- | --- |
| imotko | `src/lib/analytics/price_trends.js`, `src/lib/chat/chat_push.js`, `src/app/api/properties/ai-prefill/route.js`, `src/lib/templates_revalidation.js` (Express call only) |
| imotko-templates | `src/utils/agency_cache.js`, `src/utils/request_agency.js` (contact/appraisal forms), `src/utils/market_insights.js`, `src/lib/analytics/price_trends.js` |

## Env vars

Generate once: `openssl rand -hex 32`. Same value everywhere.

| Where | Variable | Value |
| --- | --- | --- |
| Railway (Express) | `INTERNAL_API_SECRET` | the secret |
| Dokploy (Express) | `INTERNAL_API_SECRET` | the secret |
| Vercel imotko (Production; Preview only if it calls prod Express) | `INTERNAL_API_SECRET` | the secret |
| Vercel imotko-templates (Production) | `INTERNAL_API_SECRET` | the secret |
| Railway / Dokploy (Express) | `RATE_LIMIT_ENABLED` | `true`, last step only |

## Rollout order

1. Deploy this Express code to Railway and Dokploy with `INTERNAL_API_SECRET` set and **no** `RATE_LIMIT_ENABLED`.
   Behaviour is unchanged.
2. Set `INTERNAL_API_SECRET` on both Vercel projects and deploy imotko and imotko-templates. They now send the
   header; Express ignores it while the limiter is off.
3. On the host that gets the limiter first, confirm `req.ip` is the real client IP (`DEBUG_IP_ROUTE=true`,
   `GET /debug-ip-test-imotko`, then remove the flag). A wrong `TRUST_PROXY_HOPS` would put every visitor in the
   proxy's bucket.
4. Set `RATE_LIMIT_ENABLED=true` on that host and redeploy. Check:
   - `curl -sI https://<host>/api/v1/properties` shows `RateLimit` and `RateLimit-Policy` headers.
   - The same request with `-H "X-Imotko-Internal-Secret: <secret>"` shows no `RateLimit` header (skipped).
   - Web and an agency site load; Express logs show no 429 from Vercel IPs.
5. Watch 429s for a day, then do the same on the other host.

Rollback: remove `RATE_LIMIT_ENABLED` (or set it to anything but `true`) and redeploy. No code change needed.

Rotating the secret: there is a single value, so change Express and both Vercel projects together. A short mismatch
only matters while the limiter is on (web/templates fall back to per-IP limits).

## Risk to watch

Anonymous mobile users behind carrier NAT share one IP and one 100-request bucket. If 429s show up for anonymous
mobile traffic, raise `ANONYMOUS_REQUEST_LIMIT` in `src/api/v1/middlewares/globalRateLimit.js`.

Tests: `npm run test:rate-limit`.
