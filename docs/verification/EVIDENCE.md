# Verification Evidence Log

## 2026-11-13 — Foundation + modules build (development sandbox)

Environment: Debian 13 sandbox, 2 vCPU / 2 GB RAM + 2 GB swap, OpenJDK 21.0.13,
Android SDK platform 35 / build-tools 35.0.0, Gradle 8.9 (wrapper), AGP 8.7.3, Kotlin 2.0.21.

| Check | Command | Result |
|---|---|---|
| Unit tests | `./gradlew :app:testDebugUnitTest` | **31/31 passed** (RouterTest 10, RedactorTest 5, SandboxPathsTest 5, ProviderAdapterTest 11) |
| Debug build | `./gradlew :app:assembleDebug` | BUILD SUCCESSFUL; APK 18,854,285 bytes |
| Lint | `./gradlew :app:lintDebug` | 0 errors; 3 warnings found → fixed (data-extraction rules, monochrome icon) |
| Identity | `aapt dump badging` | `package: name='com.aishub' versionCode='1' versionName='0.1.0'`; `application-label:'Ai'sHub'`; launchable `com.aishub.MainActivity`; minSdk 26 / targetSdk 35 |
| Release build | `./gradlew :app:assembleRelease` | BUILD SUCCESSFUL; R8-minified + resource-shrunk; apksigner verified |

Build iteration honesty: build #1 failed (ChatScreen `when` syntax), build #2 failed
(AgentEngine enum access, inline-lambda continue, icon imports). Both diagnosed from real
compiler output and fixed; build #3 succeeded. No errors were suppressed.

## Sandbox reset + restore (same day)

The development sandbox reset between sessions. Restored: all 84 project files intact;
signing keystore + credentials recovered from the owner's private Drive backup
(`AisHub-Keys`); toolchain reinstalled; git re-initialized.

- Rebuild #1 after restore failed: Kotlin compilation OOM (SDK install running concurrently).
- Rebuild #2: **BUILD SUCCESSFUL in 3m 34s — 31/31 tests, signed release APK verified.**
- Signer certificate unchanged: SHA-256
  `d48f90a9a51d8da1e22ae4d429b5449918c69a072c2f1d5b84c06c023730a5b4`
- Rebuilt release APK SHA-256:
  `e7cfed8fc9ec84c46024ae8499b3bc4c88cad6dd1156ecac8f56c11d1a68349d`
  (differs from pre-reset build digest — expected; build timestamps differ. Identity,
  sources, and signing key are identical.)

## GitHub publication

- Owner authorized official GitHub **device flow** (user code entered on github.com/login/device).
  Token stored only in the session vault file; never printed, never committed.
- Repository `spideycandy973-web/Ai-sHub` already existed with the owner's initial commit
  (`0f23e62`, README stub). Preserved via merge (no force-push): merge `f1f4d58`.
- Push `f1f4d58` → CI run 43311574761 **failed**: `gradlew` lost its executable bit in the
  sandbox restore (`Permission denied`, exit 126). Honest failure, diagnosed from CI logs.
- Fix commit `f03b918` (`git update-index --chmod=+x gradlew`) pushed → CI re-run.
- CI result + release asset verification: appended below when complete.

## Provider research (documented free eligibility; fetched live 2026-11-13)

| Source | Finding |
|---|---|
| https://ai.google.dev/gemini-api/docs/pricing | Free tier: gemini-3.5-flash-lite, gemini-3.8-flash, gemini-3.6-flash, gemini-4-hydrogen "Free of charge"; gemini-2.5-flash DEPRECATED; image models paid-only |
| https://ai.google.dev/gemini-api/docs/rate-limits | Free tier per-project limits shown in AI Studio; RPD resets midnight Pacific |
| https://console.groq.com/docs/rate-limits | Free plan: gpt-oss-120b/20b 30 RPM / 1K RPD / 8K TPM / 200K TPD; whisper-large-v3-turbo 20 RPM / 2K RPD |
| https://openrouter.ai/api/v1/models | Live JSON: `openrouter/free` present, pricing 0/0 |
| https://openrouter.ai/docs/api-reference/limits | Free caps ~20 RPM / 50 RPD without credit purchase; 402/429 semantics |

No live inference call was made from the sandbox (no user keys present — by design).
Live verification is per-user in-app (Dashboard → Live check).

## Release signing key

Generated 2026-11-13 (keytool, RSA 2048, SHA384withRSA, validity 9125 days, alias `aishub`).
Certificate SHA-256:
`D4:8F:90:A9:A5:1D:8D:A1:E2:2A:E4:D4:29:B5:44:99:18:C6:9A:07:2C:2F:1D:5B:84:C0:6C:02:37:30:A5:B4`
Backup: owner's private Google Drive folder `AisHub-Keys` (keystore + credentials).
Never committed, never a release asset. PKCS12 note: key password = store password.

## Device verification

Not performed — no emulator/KVM in the build environment. Owner phone install/launch is the
remaining verification step (docs/releases/INSTALL.md). Status stays **Unverified** until done.

## RELEASE VERIFIED — v0.1.0 (2026-11-13)

| Check | Result |
|---|---|
| CI (Android CI, run 43312276332, commit f03b918) | **completed success** — tests + lint + debug build + identity assertions |
| CI signing secrets | 4 secrets set via encrypted API (keystore b64, store/key password, alias) |
| Release | https://github.com/spideycandy973-web/Ai-sHub/releases/tag/v0.1.0 (id 443548751, not draft) |
| Repo visibility | Owner created it private; switched to **public** per explicit prior approval; secret-scan of tracked tree done first (no secrets) |
| Assets | AisHub-v0.1.0.apk (1,794,074 bytes) + .sha256; re-uploaded after visibility change (private-era asset URLs 404'd) |
| Authenticated download-back | SHA-256 match: e7cfed8fc9ec84c46024ae8499b3bc4c88cad6dd1156ecac8f56c11d1a68349d |
| **Unauthenticated public download** | HTTP 200, 1,794,074 bytes, **same SHA-256** (plain browser URL + API URL both verified) |
| Identity of public asset | aapt: package com.aishub, versionName 0.1.0, label Ai'sHub |
| Signature of public asset | apksigner verify OK; cert SHA-256 d48f90a9…30a5b4 (matches release key) |

Status: **Released + release-asset verified.** Device install/launch on the owner's phone
remains the only unverified step (instructions: docs/releases/INSTALL.md).

## DEVICE VERIFIED (partial) — owner's phone, 2026-11-13 04:11 (Asia/Dhaka)

Owner screenshot `Screenshot_2026-11-13-04-11-11-156_com.aishub.jpg` confirms on a physical
Android device:
- APK installed and launches (screenshot package: com.aishub)
- Dark theme renders correctly; Chat screen, message input, bottom navigation
  (Chat / Agent / Battle / Workspace) all present
- User message "hi" persisted as a chat bubble
- Fail-closed router working as designed: with no provider key configured, the request
  fails honestly with "No eligible free route for CHAT… Paid fallbacks do not exist."
  and a retry affordance — no crash, no fake response.

Verified on device: install, launch, UI render, message persistence, error handling.
Still unverified on device: live provider round-trip (owner needs to add a free key),
voice, agent execution. Next: owner adds free Gemini key → Live check → chat.


## ZERO-SETUP LIVE VERIFIED — v0.1.1 development (2026-11-13)

User requirement: open app, send message, get reply; no key/account/setup.

| Check | Result |
|---|---|
| Pollinations Classic anonymous non-stream | HTTP 200, model `gpt-oss-20b`, assistant content `Hey! How's it going?`, no user key/account |
| Pollinations Classic anonymous stream | HTTP 200 SSE, visible content assembled from deltas; reasoning fields ignored by adapter |
| AI Horde anonymous with public anonymous key | HTTP 200, model `koboldcpp/gemma-4-E4B-it`, assistant content `Hi!` |
| AI Horde exact adapter shape: **no Authorization header** | HTTP 200, model `koboldcpp/gemma-4-E4B-it`, assistant content `Hey there!`, queue wait ~0.83s |
| Local unit tests after zero-setup changes | **40/40 pass**, 0 failures/errors/skipped |
| Local debug build | `:app:assembleDebug` BUILD SUCCESSFUL |

Sanitized live evidence: `zero_setup_live_*.json` in this folder. These are real requests from the
build environment, not mocks. They do not prove the owner's phone round-trip yet; device update
verification remains pending until v0.1.1 is installed and used on the phone.

## RELEASE VERIFIED — v0.1.1 (2026-11-13)

| Check | Result |
|---|---|
| Commit | e5b42470297079812b4f5cef968d0cb5297ee8a4 (main) |
| Android CI | run 43323130317 completed success |
| Release workflow | run 43323129393 completed success |
| Release | https://github.com/spideycandy973-web/Ai-sHub/releases/tag/v0.1.1 (id 443602279, not draft/prerelease) |
| Public APK download | HTTP 200, 1,810,454 bytes |
| SHA-256 | 20a0a688f4853cee36d449db62dacc9815059dff36f2d1a9c4986dd3f0e566ef (matches published .sha256) |
| Identity | aapt: package com.aishub, versionCode 2, versionName 0.1.1, label Ai'sHub |
| Signature | apksigner verify OK; cert SHA-256 d48f90a9a51d8da1e22ae4d429b5449918c69a072c2f1d5b84c06c023730a5b4 (same as v0.1.0 → in-place update) |
| Zero-setup live smoke | Anonymous Pollinations Classic + AI Horde replies recorded above; no user key/account |

Status: **Released + release-asset verified.** Owner-phone v0.1.1 install/update and live chat
round-trip remain pending until the user installs this APK and sends a message.
