# Deployment & Release Pipeline

## Infrastructure decision

See ARCHITECTURE.md for the comparison. Summary: **no custom backend**; the app is local-first
with direct free-provider calls; **GitHub Actions** (free on public repos) provides CI and
signed releases. This is independently deployable by anyone with a GitHub account — no Arena
services, no paid hosting, no personal computer required (workflow_dispatch runs from the
GitHub mobile website).

## CI (every push)

`.github/workflows/android-ci.yml`: JDK 17 (Temurin) → Android SDK 35 → unit tests → lint →
debug APK → `aapt` identity assertions (`com.aishub`, label `Ai'sHub`) → SHA-256 → artifacts
(APK + test reports, 14-day retention). Permissions: `contents: read`.

## Release (manual, authorized)

`.github/workflows/release.yml` (`workflow_dispatch`, input: tag):
1. Restores the signing keystore from protected repo secret `AISHUB_KEYSTORE_BASE64`.
2. Runs unit tests.
3. Builds `assembleRelease` (minified, resource-shrunk) signed via env-var signing config.
4. Verifies package/label with aapt, signature with apksigner, records SHA-256.
5. Creates the GitHub Release with `AisHub-<tag>.apk` + `.sha256` using `gh release create`.
6. Deletes the keystore from the runner.

Required repo secrets (set once by the owner or an authorized agent via API):
`AISHUB_KEYSTORE_BASE64`, `AISHUB_KEYSTORE_PASSWORD`, `AISHUB_KEY_ALIAS`, `AISHUB_KEY_PASSWORD`.

## Key management (phone-friendly)

- Keystore generated once (2048-bit RSA, 25-year validity, alias `aishub`).
- Backup: owner's private Google Drive folder `AisHub-Keys/` (keystore + credentials file),
  uploaded via the authorized Drive integration; never in git, never a release asset.
- Losing the key means future updates can't overwrite-install; the Drive backup is the recovery
  path. Rotating the key requires uninstall/reinstall for users (documented in release notes).

## Rollback

Releases are immutable tags. To roll back: publish a new tag with a higher versionCode built
from the previous good commit; never overwrite an existing asset.

## Limits (verified 2026-11-13)

- GitHub Actions: unlimited minutes on public repos (standard runners); artifact storage
  counts toward the free 500 MB — retention kept at 14 days for CI artifacts.
- Release assets: up to 2 GB each; APK is ~10-20 MB.
