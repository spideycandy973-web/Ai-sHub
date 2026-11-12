# Ai'sHub v0.1.0 — first public release

**Package:** `com.aishub` · **versionName:** 0.1.0 · **versionCode:** 1 · min Android 8.0 (API 26), target API 35

## What's in this release

- **AI Chat** — streaming chat with verified free models (Gemini 3.5 Flash-Lite / 3.8 Flash,
  Groq GPT-OSS 120B/20B, OpenRouter free router), persistent conversations, search/pin/archive/
  delete, actual-model attribution, stop/retry, Markdown + copyable code blocks, JSON export.
- **AI Agent** — model-driven planning + real file tools in an app-private sandbox; 6 modes;
  supervised write approvals; persisted tasks with interruption recovery.
- **AI Battle** — blind two-model comparisons, voting + reveal, personal W/L rankings.
- **Image Studio** — real local editing (rotate/crop/resize). AI generation is honestly
  **blocked**: no compliant free hosted image API exists as of 2026-11-13 (verified).
- **Voice AI** — Android speech recognition + TextToSpeech voice conversations, editable
  transcripts, stop controls, text fallback.
- **Research** — official Wikipedia API search + article reading + free-model synthesis with
  citations to sources actually accessed; saved Markdown reports.
- **Developer Hub** — official GitHub device flow, repository listing, release/asset and
  workflow-run inspection.
- **Workspace** — projects, notes, instructions, search.
- **Free AI Access Dashboard** — verified registry with dates/sources, live checks, cooldowns,
  locally-counted usage (never invented quota).
- **Error Center** — redacted, bounded local diagnostics; copy/export/clear.
- **Zero-paid enforcement** — fail-closed free-only routing; no paid fallback exists.

## Verified for this release

- 31/31 JVM unit tests (routing policy, redaction, sandbox paths, adapter contracts incl. SSE).
- Lint + debug + signed release builds; aapt identity checks; apksigner verification.
- Release asset downloaded back and SHA-256-compared after publication (see docs/verification/EVIDENCE.md).

## Known limitations

- Live provider calls need YOUR free API key (Settings → Free provider keys). No key = local
  features only. Free tiers have daily limits; the app degrades honestly, never bills.
- AI image generation: blocked (no verified free API). General web search: Wikipedia-only scope.
- Agent cloud terminal/build execution: not in v0.1 (GitHub Actions path documented).
- In-app Google Drive OAuth: not in v0.1. Bengali translation: not started (structure ready).
- Physical-device install/launch verification: pending owner's phone (instructions in
  docs/releases/INSTALL.md). No emulator was available in the build environment.

## Signing

Signed with the Ai'sHub release key (RSA 2048). Certificate SHA-256:
`D4:8F:90:A9:A5:1D:8D:A1:E2:2A:E4:D4:29:B5:44:99:18:C6:9A:07:2C:2F:1D:5B:84:C0:6C:02:37:30:A5:B4`
Future updates will use the same identity (key backed up privately).

## Install

See [INSTALL.md](INSTALL.md) — download the APK below on your phone and open it.
