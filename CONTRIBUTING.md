# Contributing

Thanks for your interest in Ai'sHub!

## Ground rules

1. **Zero-paid policy is non-negotiable.** PRs adding paid models, paid endpoints, paid
   fallbacks, billing surfaces, or card-required services will be declined.
2. Keep the identity: application label `Ai'sHub`, application ID `com.aishub`.
3. Genuinely native: no WebView shells or packaged websites.
4. Honest status: don't mark features complete without evidence; mocked tests are labeled.
5. No secrets in code, logs, docs, or screenshots.

## Workflow

1. Fork / branch from `main`.
2. Make focused changes; add or update tests (`android/app/src/test/`).
3. Run `./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug`.
4. Update docs + `docs/verification/REQUIREMENTS_MATRIX.md` if behavior changed.
5. Open a PR describing what changed, what you tested, and any free-tier implications.

## Provider additions

Follow `docs/DEVELOPMENT.md` → "Adding a provider route". Official free-tier evidence
(URL + verification date) is required in the registry entry and AI_PROVIDERS.md.
