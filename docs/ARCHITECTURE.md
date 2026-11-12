# Architecture

## Decision summary (2026-11-13)

**Selected: local-first Android app + user-owned free provider keys + GitHub Actions for CI/release.
No custom backend server in v0.1.0.**

### Why no backend

Researched options (official sources checked 2026-11-13):

| Option | Free reality | Verdict |
|---|---|---|
| Cloudflare Workers + D1 | Free tier exists (100K req/day Workers) but agent execution/queues add complexity; card not required | Optional later; not needed for v0.1 |
| Supabase free | 500 MB DB, projects pause after ~1 week inactivity; no card | Pausing breaks durable agent jobs; rejected for v0.1 |
| Firebase Spark | Generous free quotas, but Firestore/Auth lock-in and Google Cloud project setup from a phone is heavy | Rejected for v0.1 |
| GitHub Actions | Free unlimited minutes on **public** repos; artifacts 90-day retention default; already required for source hosting | **Selected** for build/test/release automation |
| Local Android + direct provider APIs | $0, no server to pause/expire/bill; keys stay on device | **Selected** as the primary runtime |

A custom router backend would add a hosted secret, an availability dependency, and a billing
surface for zero functional gain at this stage: the app routes directly to provider APIs with
the user's own free keys. The routing policy lives in shared, unit-tested Kotlin code.

## Components

```
com.aishub
├── core/            SecureVault (Keystore AES-GCM), Redactor, UrlGuard (SSRF checks)
├── domain/          ModelRoute, Capability, Eligibility, GenerationRequest/Result, errors
├── data/
│   ├── registry/    FreeModelRegistry — verified free routes + staleness policy
│   ├── provider/    ProviderAdapter contract; GeminiAdapter, OpenAiCompatAdapter (Groq/OpenRouter)
│   ├── router/      ModelRouter — fail-closed free-only selection, cooldowns, health, routing log
│   ├── db/          Room: conversations, messages, battles, projects, notes, agent tasks,
│   │                errors, usage, research reports (FK cascades, indexes, schema export)
│   ├── settings/    DataStore preferences (theme, model choice, generation params, privacy)
│   ├── keys/        Encrypted per-provider key storage (presence-only exposure to UI)
│   ├── errors/      ErrorCenter — redacted, bounded (200 records / 30 days), local-only
│   ├── github/      GitHubClient (REST), GitHubDeviceFlow (official OAuth device flow)
│   ├── voice/       VoiceEngine — Android SpeechRecognizer + TextToSpeech
│   └── research/    ResearchEngine — Wikipedia API + guarded HTTPS fetch
├── agent/           AgentEngine — planner/executor with sandboxed file tools, approvals,
│                    persisted checkpoints; SandboxPaths (traversal/symlink protection)
├── di/              ServiceLocator — manual DI, no framework
└── ui/              Compose Material 3; drawer + bottom nav; one screen package per module
```

## Trust boundaries

1. **Device ↔ provider**: HTTPS only; user key sent only to its own provider; free-tier privacy
   terms disclosed per route in the registry and dashboard.
2. **Model output ↔ tools**: model output is parsed as a *request* (typed ToolCall); the engine
   enforces sandbox paths, mode permissions, and approvals. Model text can never widen policy.
3. **Web content ↔ app**: research pages are untrusted evidence; UrlGuard blocks non-HTTPS,
   loopback, private, link-local, and metadata addresses before fetch.
4. **Secrets ↔ everything else**: keys/tokens live encrypted (Keystore-wrapped AES-GCM);
   diagnostics pass through Redactor; exports never include credentials.

## Data flow (chat)

UI → ChatRepository.send → ModelRouter.select (eligible+keyed+healthy) → adapter.stream →
partial text persisted to Room every ~256 chars → final result with actual model ID + usage →
UsageRecord + router health update. Failures classify (auth/rate/quota/unavailable/malformed),
cool the route down, and try the next eligible route with disclosure — never a paid route.

## Persistence & recovery

- Room v1 with exported schema (`android/app/schemas/`); destructive migration only on downgrade.
- Agent tasks persist plan + log after every step; on restart, `running` tasks become `paused`
  (manual resume) to avoid duplicate side effects.
- DataStore for preferences; encrypted SharedPreferences for key material.

## What is deliberately not here yet

- No WebView anywhere; no packaged website.
- No cloud agent terminal: untrusted code execution requires an isolated runner. The documented
  path is GitHub Actions on an authorized repo (see AGENT_TOOLS.md); wiring agent→CI dispatch is
  the next milestone, not claimed done.
- Bengali translation: resource structure ready, translation not started (honest status).
