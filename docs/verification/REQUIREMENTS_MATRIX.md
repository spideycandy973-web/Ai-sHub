# Requirements → Evidence Matrix (v0.1.1, 2026-11-13)

Status vocabulary: Planned / Implemented / Locally tested / CI verified / Live integration verified / Device verified / Released / Blocked / Unverified.
A mocked test never upgrades a feature to "Live integration verified".

| Requirement | Implementation | Evidence | Status |
|---|---|---|---|
| Identity: label Ai'sHub, ID com.aishub | `AndroidManifest.xml`, `build.gradle.kts`, `strings.xml` | aapt badging on built APK (see EVIDENCE.md) | **CI verified** (run 43312276332) |
| Native Kotlin + Compose M3, no WebView | entire `ui/` (no WebView import anywhere) | build + code inspection | Implemented |
| MVVM/Clean boundaries, Coroutines/Flow | `data/`, `domain/`, `ui/` separation; StateFlow/Flow throughout | compile + tests | Implemented |
| Room + DataStore + WorkManager deps | `Database.kt`, `SettingsStore.kt`, catalog | Room schema exported; unit build | Implemented (WorkManager wired as dependency; no scheduled jobs yet — Planned) |
| Themes light/dark/system persisted | `Theme.kt`, `SettingsStore` | DataStore flow; manual device check pending | Implemented / Device Unverified |
| 8-module navigation + drawer | `Navigation.kt` | compile; device check pending | Implemented / Device Unverified |
| Free-only registry + fail-closed routing | `FreeModelRegistry.kt`, `ModelRouter.kt` | `RouterTest` 13 tests | Locally tested |
| Zero-setup chat: no key/account/config | Pollinations Classic + AI Horde anonymous routes; ChatRepository keyless path | 40/40 local tests; live anonymous smoke replies (EVIDENCE.md) | **Live integration verified** (build env); device round-trip pending |
| ≥2 free providers real requests | Pollinations/Horde anonymous + optional Gemini/Groq/OpenRouter adapters | anonymous live smoke; optional keyed adapter contract tests | Implemented; anonymous live verified, optional keyed live requires user keys |
| Streaming + attribution | adapters + `ChatRepository` | SSE tests; actualModelId parsed from responses | Locally tested |
| History/search/rename/pin/archive/delete | `ChatDao`, `ChatListScreen` | compile; UI device test pending | Implemented |
| Export (no secrets) | `exportConversation` | format documented; unit test planned | Implemented |
| Attachments (image/PDF to model) | — | — | Planned (v0.2) |
| Agent real tools + sandbox + approvals | `AgentEngine`, `SandboxPaths` | `SandboxPathsTest` 5 tests; mode policy in code | Locally tested (paths); model-driven flow Implemented, device Unverified |
| Agent cloud terminal/build execution | — | GitHub Actions path documented | Blocked (isolated runner wiring is v0.2) |
| Battle blind compare + votes + rankings | `BattleScreen`, `BattleDao` | compile; logic reviewed | Implemented / Device Unverified |
| Image AI generation | — | official pricing checked: no free route | Blocked (honest UI state) |
| Image local editing | `ImageStudioScreen` | compile | Implemented / Device Unverified |
| Voice STT/TTS + conversation | `VoiceEngine`, `VoiceScreen` | compile; needs physical device | Implemented / Device Unverified |
| Research free search + citations | `ResearchEngine`, `ResearchScreen` | Wikipedia API official; compile | Implemented / Live Unverified |
| GitHub device flow + browse + releases/CI | `GitHubDeviceFlow`, `GitHubClient`, `DeveloperScreen` | compile; live test pending user OAuth App | Implemented / Live Unverified |
| Workspace projects/notes/instructions | `WorkspaceScreen`, `WorkspaceDao` | compile | Implemented |
| Google Drive in-app OAuth | — | development-session backup only | Blocked (v0.2; needs Google Cloud OAuth client) |
| Free AI Access Dashboard | `DashboardScreen` | shows only verified/local-counted data | Implemented |
| Error Center redaction/retention/export | `ErrorCenter`, `Redactor`, `ErrorCenterScreen` | `RedactorTest` 5 tests | Locally tested |
| Keystore-backed key encryption | `SecureVault`, `KeyStore` | AES-GCM envelope; device test pending | Implemented / Device Unverified |
| SSRF guard for fetches | `UrlGuard` | code; unit test planned | Implemented |
| Zero-paid enforcement | registry+router+tests | `RouterTest` incl. 402/no-image-route tests | Locally tested |
| CI tests+lint+APK+identity | `android-ci.yml` | run 43312276332 success | **CI verified** |
| Signed release + asset verification | release v0.1.0 + API publication | public download SHA-256 match + aapt + apksigner (EVIDENCE.md) | **Released** |
| Bengali localization | strings externalized | translation not started | Planned (honest) |
| Accessibility | contentDescription on icons, M3 defaults | TalkBack device test pending | Implemented / Device Unverified |

## Explicitly NOT claimed in v0.1.1

Cloud sync, conversation import UI, PDF/document analysis, in-app Drive, agent CI dispatch,
Bengali translation, instrumented UI test coverage, performance measurements.
