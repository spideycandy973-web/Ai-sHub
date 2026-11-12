# Testing

## Test types in this repo

| Suite | Location | Kind | What it proves |
|---|---|---|---|
| `RouterTest` (13 tests) | `android/app/src/test/.../RouterTest.kt` | JVM unit, real registry + injected clock/keys | Zero-setup anonymous routing, optional key gating, fail-closed staleness, cooldowns, switching disclosure, no paid/image routes |
| `RedactorTest` (5) | `RedactorTest.kt` | JVM unit | Secret redaction for Google/Groq/OpenRouter/GitHub/bearer patterns |
| `SandboxPathsTest` (5) | `SandboxPathsTest.kt` | JVM unit | Traversal, absolute-path, nested traversal, symlink-escape rejection |
| `ProviderAdapterTest` (10) | `ProviderAdapterTest.kt` | JVM unit + MockWebServer | Request shape, SSE streaming parse, actual-model attribution, error classification (401/402/429/5xx), safety-block handling |
| `ZeroSetupAdapterTest` (6) | `ZeroSetupAdapterTest.kt` | JVM unit + MockWebServer | Anonymous Pollinations/Horde requests send no Authorization header, Classic 402 is a free-slot wait, Horde online-model selection, reasoning fields are not shown |

**These are mocked/policy tests.** They verify logic, not live provider availability.

## Commands

```bash
./gradlew :app:testDebugUnitTest        # unit tests
./gradlew :app:lintDebug                # Android lint
./gradlew :app:assembleDebug            # debug APK
./gradlew :app:assembleRelease          # signed release (requires env keystore vars)
```

## Evidence log

See `docs/verification/EVIDENCE.md` for dated runs (commit, command, result, artifact).
CI (`.github/workflows/android-ci.yml`) runs tests + lint + debug build + identity checks on
every push and uploads reports as artifacts.

## Live smoke tests (opt-in, bounded)

Zero-setup routes were live-verified anonymously during development (see EVIDENCE.md). In-app:
- Free AI Access Dashboard → "Live check" (one small real request per tap), or
- first real chat/battle/research usage (attributed + recorded in usage log).

Optional keyed routes still require the user's own free key. No automated live-key tests run in CI
(no provider secrets in CI; zero-quota-waste policy).

## Not yet covered (honest)

- Instrumented UI tests / emulator runs: no emulator available in the build environment
  (no KVM). Compose UI is exercised by lint + compile-time checks only so far.
- Room migration tests: v1 is the first schema; migrations will add tests when v2 lands.
- Device-specific STT/TTS behavior: requires physical-device verification (owner's phone).
- Performance measurements: none claimed yet.
