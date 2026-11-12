# Ai'sHub

**A native Android AI platform built on a strict zero-paid policy.**
Package: `com.aishub` · Language: Kotlin · UI: Jetpack Compose + Material 3 · Min Android 8.0 (API 26)

> Status: v0.1.0 — first public release. See [Feature status](#feature-status) for exactly what is
> implemented, tested, and verified vs. blocked. No feature is claimed complete without evidence.

## What it is

Ai'sHub combines eight modules in one native app:

| Module | v0.1.0 status |
|---|---|
| **AI Chat** | Implemented: streaming chat via Gemini / Groq / OpenRouter free tiers, persistent history, model attribution, pin/archive/delete/search, retry, stop, copy, Markdown + code blocks, JSON export |
| **AI Agent** | Implemented (on-device scope): model-driven planning + real file tools in an app-private sandbox, 6 modes, supervised approvals, persisted tasks/logs, interruption recovery. Cloud terminal execution: **Blocked** (see AGENT_TOOLS.md) |
| **AI Battle** | Implemented: same prompt → two independent free models, blind A/B, vote + reveal, persistent history, personal W/L rankings |
| **Image Studio** | Local editing implemented (rotate/crop/resize, offline). AI generation: **Blocked** — no verified free hosted image API exists as of 2026-11-13; never faked |
| **Voice AI** | Implemented: Android SpeechRecognizer + TextToSpeech, voice conversation loop, transcripts, stop controls, permission handling, text fallback |
| **Research** | Implemented (free scope): official Wikipedia API search + article reading + free-model synthesis with real citations, saved Markdown reports |
| **Developer Hub** | Implemented: official GitHub device flow (your own OAuth App client ID), repo listing, release/asset inspection, workflow-run status. In-app commit tooling: implemented in client, live mutation test pending |
| **Workspace** | Implemented: projects, notes, instructions, search, delete; agent sandboxes are project-scoped |

Plus: **Free AI Access Dashboard** (verified registry, live health checks, local-only usage counting),
**Error Center** (redacted, bounded, never auto-uploaded), **Settings** (themes, encrypted keys, privacy wipe).

## Zero-paid policy

- No paid models, endpoints, subscriptions, or fallbacks exist anywhere in the codebase.
- Cloud routes fail closed unless `VERIFIED_FREE` **and** verification is < 30 days old.
- You bring your own **free-tier** API keys (Gemini / Groq / OpenRouter). Keys are encrypted
  with an Android Keystore-backed AES-GCM vault and never unlock paid routes.
- Remaining provider quota is shown as **Unknown** — never invented.

## Get the app

Download the APK from [Releases](https://github.com/spideycandy973-web/Ai-sHub/releases).
See [docs/releases/INSTALL.md](docs/releases/INSTALL.md) for phone installation steps.

## Build from source

```bash
# JDK 17+, Android SDK (platform 35, build-tools 35.0.0)
./gradlew :app:assembleDebug :app:testDebugUnitTest
```

The Gradle wrapper is committed; CI builds and tests every push (`.github/workflows/android-ci.yml`).

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — components, trust boundaries, decisions
- [AI_PROVIDERS.md](docs/AI_PROVIDERS.md) — verified free registry + evidence
- [FREE_ACCESS_POLICY.md](docs/FREE_ACCESS_POLICY.md) — zero-paid enforcement
- [AGENT_TOOLS.md](docs/AGENT_TOOLS.md) — tool contracts, sandbox, approvals
- [SECURITY.md](SECURITY.md) — threat model + reporting
- [PRIVACY.md](docs/PRIVACY.md) — actual data flows
- [TESTING.md](docs/TESTING.md) — what ran, what's mocked, what's live
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — infrastructure decision + release pipeline
- [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- [Requirements matrix](docs/verification/REQUIREMENTS_MATRIX.md) · [Blocker register](docs/verification/BLOCKERS.md)

## License

No open-source license has been granted yet — all rights reserved by the repository owner until a
license is explicitly chosen. Third-party dependencies retain their own licenses (see docs/THIRD_PARTY.md).
