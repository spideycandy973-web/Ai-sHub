# AI Providers — verified free registry

Verification date: **2026-11-13**. Re-verify at least every 30 days (router fails closed on stale entries).

## Verification levels used

- **Documented free eligibility**: official pricing/limits page fetched and read.
- **Live API verification**: a real request succeeded with a real key.
- The registry ships with documented eligibility. Live verification happens per-user on their
  first real request / dashboard "Live check" — the app never claims a route is live-verified
  until that user's request actually succeeded.

## Zero-setup text/chat routes (default, no user key)

| Route | Model ID | Evidence (2026-11-13) | Documented limits |
|---|---|---|---|
| Pollinations Classic (no setup) | `openai-fast` (served as GPT-OSS 20B) | Official Classic APIDOCS: free/no-signup; live anonymous POST `/openai` returned a real reply | Anonymous, one text request at a time per IP, at least 30s apart; HTTP 402 + Retry-After when the free slot is not ready; best effort |
| AI Horde auto (no setup) | `auto` → up to 5 online text models via official `models` array | Official OpenAI-compatible front docs: anonymous access; live anonymous POST with **no Authorization header** returned a real reply | Volunteer workers, lowest queue priority, model list changes, may wait or be unavailable under load |

Live smoke evidence is in `docs/verification/EVIDENCE.md` and `docs/verification/zero_setup_live_*.json`.
These are real anonymous requests, not mocked. They do not guarantee future uptime or quota.

## Optional keyed text/chat routes (all VERIFIED_FREE, documented)

| Route | Model ID | Evidence (fetched 2026-11-13) | Documented limits |
|---|---|---|---|
| Gemini 3.5 Flash-Lite | `gemini-3.5-flash-lite` | ai.google.dev/gemini-api/docs/pricing — "Free of charge" input/output | Per-project RPM/RPD in AI Studio; RPD resets midnight Pacific; no card |
| Gemini 3.8 Flash | `gemini-3.8-flash` | same page — free tier column "Free of charge" | same |
| GPT-OSS 120B (Groq) | `openai/gpt-oss-120b` | console.groq.com/docs/rate-limits — Free Plan table | 30 RPM, 1K RPD, 8K TPM, 200K TPD |
| GPT-OSS 20B (Groq) | `openai/gpt-oss-20b` | same table | 30 RPM, 1K RPD, 8K TPM, 200K TPD |
| OpenRouter Free Router | `openrouter/free` | openrouter.ai/api/v1/models live JSON — pricing prompt=0, completion=0; /docs limits page | ~20 RPM, 50 RPD free (no credit purchase); underlying model rotates and is reported per response |

### Important findings from this verification pass

- **`gemini-2.5-flash` is deprecated** (official deprecation notice on the pricing page; requests
  auto-route to `gemini-3.5-flash-lite` after 2026-12-01). It is NOT in the registry.
- Third-party blogs still quote 2025-era "2.5 Flash 500 RPD" numbers — treated as stale, not used.
- Groq free-plan model list has changed over time (Llama moved off free); registry uses the
  current official table only.

## Speech

| Route | Evidence | Notes |
|---|---|---|
| Android SpeechRecognizer | developer.android.com reference | On-device API; the selected system recognizer may use network. Availability varies by device. VERIFIED_LOCAL (device verification pending) |
| Android TextToSpeech | developer.android.com reference | Depends on installed engine/voices. VERIFIED_LOCAL |
| Whisper Large v3 Turbo (Groq) | console.groq.com/docs/rate-limits free table | 20 RPM, 2K RPD, 7.2K audio-sec/hour. Registered; in-app upload path not yet wired (honest status) |

## Image generation — BLOCKED

Checked 2026-11-13: Gemini image models ("Nano Banana" line incl. 2.5 Flash Image, 3.1 Flash
Image/Lite Image, Nano Banana 2.1) show **"Not available"** in the Free Tier column of the
official pricing page. No other compliant free hosted image API was verified. Pollinations Classic **text** is now adopted for zero-setup chat after official docs + live anonymous verification.
Pollinations image generation is still not adopted as a verified free image route for this app.
**Result: no IMAGE_GEN cloud route exists. Image Studio shows the verified limitation and keeps
local editing. Nothing is faked.**

## Search

General web-search APIs (Google CSE, Bing, Brave, Serper) are paid or card-gated beyond trivial
trials → not used. The official **Wikipedia/MediaWiki API** is free and permitted; Research uses
it plus direct HTTPS reads of the articles it cites.

## Keys

**Not required for normal chat.** Optional advanced users may create their own free keys:
- Gemini: aistudio.google.com/api-keys (free tier, no card)
- Groq: console.groq.com/keys (free plan, no card)
- OpenRouter: openrouter.ai/settings/keys (free models, no purchase)

Keys are stored encrypted on-device (Keystore-backed AES-GCM). A key can never enable a paid
route: routing only considers registry entries that are VERIFIED_FREE and fresh.

## Bangladesh eligibility

Gemini API free tier: Google lists Bangladesh among supported Gemini API regions (country list
checked at ai.google.dev/gemini-api/docs/available-regions). Groq/OpenRouter do not publish a
BD exclusion; account creation from BD is expected to work but is **user-account dependent** —
the app reports auth/region errors honestly if a provider rejects the account. No live
account-level verification was possible without the user's own credentials.
