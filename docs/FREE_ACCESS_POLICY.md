# Free Access Policy (zero-paid enforcement)

Authorized spending: **$0.00, absolute.** This document describes the enforcement actually
implemented in code, not aspirations.

## Enforcement points

1. **Registry allowlist** (`FreeModelRegistry`): the only cloud routes that exist are
   `VERIFIED_FREE` entries with a source URL and verification date. There is no code path that
   constructs a paid endpoint. Adding a route requires a code change reviewed against this policy.
2. **Fail-closed staleness**: `ModelRouter` refuses any route whose verification is older than
   30 days (`STALE_DAYS`). An old app build eventually routes nothing rather than guessing.
3. **Capability + key filters**: routes require the needed capability. Zero-setup anonymous
   routes require no user key; optional BYOK routes require the user's own free-tier key.
4. **Error classification**: Pollinations Classic HTTP 402 is treated as a free-slot rate limit
   (`RateLimited`, honoring `Retry-After`) because the official Classic API uses 402 for anonymous
   spacing. Other HTTP 402 responses are payment/credit refusals (`QuotaExhausted`, 6h cooldown).
   Quota-shaped 429s suspend the route. 401/403 suspends until the user fixes the key (or, for
   anonymous routes, until the service changes). **No retry ever escalates to payment.** Unit tests
   cover these classifications.
5. **No billing surfaces**: the app contains no purchase UI, no credit top-up links, no paid
   toggles, no "upgrade" fallback. OpenRouter is used only via `openrouter/free` ($0 routes);
   the app never sends paid model IDs.
6. **Local-first degradation**: when every cloud route is unavailable, the app still opens and
   all local features work (history, workspace, notes, local image editing, TTS/STT where the
   device supports it, error center, settings).

## What "verified" means here

- Documented free eligibility: official page fetched (see AI_PROVIDERS.md for dates/URLs).
- Live verification: only after a real request succeeds (dashboard Live Check or normal use).
- Remaining quota: **Unknown** unless a provider explicitly reports it; local request counts
  are labeled "locally counted" and never presented as provider quota.

## Quota exhaustion behavior

Rate limit → cooldown honoring `Retry-After` → try next eligible free route with disclosure
("Model switched: now using X") → if none, honest error: "No eligible free route… No account, key,
or payment is required; paid fallbacks do not exist." Conversations and partial outputs are preserved.

## Review cadence

- Re-verify all registry sources every 30 days and before each release.
- Any billing-related error or terms change → route suspended → registry entry moved to
  `REVIEW_REQUIRED` in the next patch.
