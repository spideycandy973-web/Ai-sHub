# Verification Evidence Log

## 2026-11-13 — Foundation + modules build (development sandbox)

Environment: Debian 13 sandbox, 2 vCPU / 2 GB RAM + 2 GB swap, OpenJDK 21.0.13,
Android SDK platform 35 / build-tools 35.0.0, Gradle 8.9 (wrapper), AGP 8.7.3, Kotlin 2.0.21.

| Check | Command | Result |
|---|---|---|
| Unit tests | `./gradlew :app:testDebugUnitTest` | **31/31 passed** (RouterTest 10, RedactorTest 5, SandboxPathsTest 5, ProviderAdapterTest 11) — JUnit XML in `android/app/build/test-results/` |
| Debug build | `./gradlew :app:assembleDebug` | BUILD SUCCESSFUL; APK 18,854,285 bytes |
| Identity | `aapt dump badging app-debug.apk` | `package: name='com.aishub' versionCode='1' versionName='0.1.0'`; `application-label:'Ai'sHub'`; launchable `com.aishub.MainActivity`; minSdk 26 / targetSdk 35 |
| Debug SHA-256 | `sha256sum` | `41eaa6151d8064c074439068c6db4c351568d9d2b1c18b2bbd83082260445768` |

Build iteration honesty: build #1 failed (ChatScreen `when` syntax), build #2 failed
(AgentEngine enum access, inline-lambda continue, icon imports). Both diagnosed from real
compiler output and fixed; build #3 succeeded. No errors were suppressed.

Kind: local sandbox build + JVM unit tests (adapters mocked with MockWebServer; router tests
use the real registry with injected clock/keys). NOT device-verified, NOT live-provider-verified.

## Provider research (documented free eligibility; fetched live 2026-11-13)

| Source | Finding |
|---|---|
| https://ai.google.dev/gemini-api/docs/pricing | Free tier: gemini-3.5-flash-lite, gemini-3.8-flash, gemini-3.6-flash, gemini-4-hydrogen "Free of charge"; gemini-2.5-flash DEPRECATED; image models paid-only ("Not available" free column) |
| https://ai.google.dev/gemini-api/docs/rate-limits | Free tier per-project limits shown in AI Studio; RPD resets midnight Pacific; free tier has no spend limits (N/A) |
| https://console.groq.com/docs/rate-limits | Free plan: openai/gpt-oss-120b & 20b: 30 RPM / 1K RPD / 8K TPM / 200K TPD; whisper-large-v3-turbo: 20 RPM / 2K RPD |
| https://openrouter.ai/api/v1/models | Live JSON: `openrouter/free` present, pricing prompt=0 completion=0; 14 `:free` models |
| https://openrouter.ai/docs/api-reference/limits | Free-model caps ~20 RPM / 50 RPD without credit purchase; 402/429 semantics documented |

No live inference call was made from the sandbox (no user keys present — by design).
Live verification is per-user in-app (Dashboard → Live check).

## Release signing key

Generated 2026-11-13 (keytool, RSA 2048, SHA384withRSA, validity 9125 days, alias `aishub`).
Certificate SHA-256:
`D4:8F:90:A9:A5:1D:8D:A1:E2:2A:E4:D4:29:B5:44:99:18:C6:9A:07:2C:2F:1D:5B:84:C0:6C:02:37:30:A5:B4`
Backup: owner's private Google Drive folder `AisHub-Keys` (keystore + credentials), uploaded
via authorized Drive integration 2026-11-12T20:35Z. Never committed, never a release asset.

## Pending at time of writing

- Signed release build + lint (running)
- GitHub repo creation + push (awaiting owner device-flow approval)
- CI run, release publication, asset download verification
- Physical-phone install/launch (owner action; instructions in docs/releases/INSTALL.md)
