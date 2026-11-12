# Development (phone-friendly, cloud-based)

## Workflow used for this project

All development happens in cloud sandboxes (Arena Agent Mode) + GitHub. The owner needs only
an Android phone and a GitHub account:

1. Agent writes/edits code in the workspace and runs Gradle locally in the sandbox.
2. Agent pushes to `main` on github.com/spideycandy973-web/Ai-sHub.
3. GitHub Actions runs tests/lint/build on every push (free, public repo).
4. Releases are built by the Release workflow (workflow_dispatch) with protected signing secrets.
5. Owner downloads the APK from Releases on the phone and installs it.

## Toolchain (pinned, verified building on 2026-11-13)

- Gradle 8.9 (wrapper committed)
- Android Gradle Plugin 8.7.3
- Kotlin 2.0.21 (+ Compose compiler plugin, KSP 2.0.21-1.0.28)
- compileSdk/targetSdk 35, minSdk 26, build-tools 35.0.0
- JDK 17+ (CI: Temurin 17; sandbox builds also verified on JDK 21)
- Compose BOM 2024.12.01, Material3, Navigation 2.8.5, Room 2.6.1, DataStore 1.1.1,
  WorkManager 2.9.1, OkHttp 4.12, Retrofit 2.11 (dependency catalog: `gradle/libs.versions.toml`)

## Commands

```bash
./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
# Release (needs AISHUB_KEYSTORE_* env vars; CI provides them from secrets):
./gradlew :app:assembleRelease
```

## Branch rules

Work happens on `main` (the repository's default branch). No force-pushes. Coherent commits
with evidence in messages. The app's own GitHub tools may only mutate branches the user
explicitly authorizes.

## Repository layout

- `android/app/` — the Android application (single module in v0.1; package boundaries under
  `com.aishub` enforce Clean Architecture: `core`, `domain`, `data`, `agent`, `ui`, `di`)
- `docs/` — all required documentation + verification evidence
- `.github/workflows/` — CI + release
- `gradle/` — wrapper + version catalog

## Adding a provider route (policy-gated)

1. Verify the free tier on the provider's official page (record URL + date).
2. Add a `ModelRoute` with `VERIFIED_FREE`, source, date, limits, privacy note.
3. Add/extend an adapter behind `ProviderAdapter`; classify errors with `classifyHttp`.
4. Add router/adapter tests. Run the full suite.
5. Update AI_PROVIDERS.md and the requirements matrix.

Never add a route whose basic operation requires payment, a card, or expiring trial credits.
