# Security

## Threat model (summary)

| Asset | Threat | Mitigation implemented |
|---|---|---|
| Provider API keys, GitHub token | Extraction from device/backup | Keystore-backed AES-GCM vault (`SecureVault`); `allowBackup=false`; keys never in logs/exports/UI state (presence flags only) |
| Conversations/projects | Cross-app access | App-private storage; Room in private dir; no external storage writes without user action |
| Agent sandbox | Path traversal / symlink escape | Canonical-path containment (`SandboxPaths`, unit-tested) |
| Prompt injection via model output | Unauthorized tool use | Typed tool parsing; mode policy enforced outside the model; writes blocked/approved per mode |
| Research fetches | SSRF to private/metadata endpoints | `UrlGuard`: HTTPS-only, DNS resolution check against loopback/link-local/site-local/metadata hosts |
| Diagnostics | Secret leakage | `Redactor` patterns for Google/Groq/OpenRouter/GitHub tokens + bearer/api-key shapes; bounded retention; no auto-upload |
| Network | MITM | HTTPS only; `usesCleartextTraffic=false`; system trust store (no custom trust) |
| CI/release | Secret exposure to untrusted code | Workflows use least-privilege `permissions`; no `pull_request_target`; signing secrets only in the release job; keystore deleted after use |
| GitHub auth | Credential phishing | Official device flow only; no password field anywhere; no client secret embedded |

## Signing

Release APKs are signed with a dedicated release key. The keystore is generated once, backed up
to the owner's private Google Drive (encrypted vault path), and stored as protected GitHub
Actions secrets for CI signing. It is never committed, never logged, never a release asset.
SHA-256 of the certificate is published in release notes for update-identity verification.

## Known limitations (honest)

- Vault protects data at rest; a rooted/compromised device with a running app can still read
  decrypted keys in memory. Standard Android threat model applies.
- `UrlGuard` validates DNS before fetch; a DNS-rebinding race between check and connection is
  theoretically possible client-side. Impact is limited (device has no internal services);
  the guard is still enforced. Server-side fetching does not exist in v0.1.
- Free-tier providers may train on prompts (disclosed per route). Do not send sensitive data.
- Room v1: no migrations yet (first version). Schema exported for future migration tests.

## Reporting a vulnerability

Open a GitHub security advisory at
https://github.com/spideycandy973-web/Ai-sHub/security/advisories (preferred), or create an
issue **without** exploit details and request a private contact. Please do not include real
tokens or personal data in reports.
