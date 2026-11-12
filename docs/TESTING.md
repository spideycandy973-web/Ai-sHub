# Testing

## Test types in this repo

| Suite | Location | Kind | What it proves |
|---|---|---|---|
| `RouterTest` (10 tests) | `android/app/src/test/.../RouterTest.kt` | JVM unit, real registry + injected clock/keys | Fail-closed routing, staleness, cooldowns, switching disclosure, no paid/image routes, key gating |
| `RedactorTest` (5) | `RedactorTest.kt` | JVM unit | Secret redaction for Google/Groq/OpenRouter/GitHub/bearer patterns |
| `SandboxPathsTest` (5) | `SandboxPathsTest.kt` | JVM unit | Traversal, absolute-path, nested traversal, symlink-escape rejection |
| `ProviderAdapterTest` (10) | `ProviderAdapterTest.kt` | JVM unit + MockWebServer | Request shape, SSE streaming parse, actual-model attribution, error classification (401/402/429/5xx), safety-block handling |

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

Live provider verification requires the user's own free keys and happens:
- in-app: Free AI Access Dashboard → "Live check" (one small real request per tap), or
- first real chat/battle/research usage (attributed + recorded in usage log).

No automated live-key tests run in CI (no secrets in CI for providers; zero-quota-waste policy).

## Not yet covered (honest)

- Instrumented UI tests / emulator runs: no emulator available in the build environment
  (no KVM). Compose UI is exercised by lint + compile-time checks only so far.
- Room migration tests: v1 is the first schema; migrations will add tests when v2 lands.
- Device-specific STT/TTS behavior: requires physical-device verification (owner's phone).
- Performance measurements: none claimed yet.
