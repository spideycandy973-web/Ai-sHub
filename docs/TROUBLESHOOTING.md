# Troubleshooting

## "No eligible free route…"
- Add at least one free provider key: Settings → Free provider keys (Gemini / Groq / OpenRouter).
- If all routes are in cooldown, wait (rate limits reset per provider policy; Gemini RPD resets
  midnight Pacific) or tap "Clear cooldown" on the dashboard after the underlying issue is fixed.
- If the app build is older than 30 days, registry verification is stale by design — update the app.

## "Authentication failed (401/403)"
The key is wrong, revoked, or the account isn't eligible. Create a fresh free key at the
provider (links in Settings), remove the old one, add the new one. The route stays suspended
until you do — this is intentional.

## "Provider quota exhausted"
Free daily/minute limits were hit. The router switches to another eligible free provider
automatically (with disclosure) or tells you honestly when none remain. It will never suggest
paying. Try again after the provider's reset window.

## Gemini model errors / model not found (404)
Provider model lineups change (e.g., `gemini-2.5-flash` was deprecated in late 2026). Update the
app — registry entries are versioned with the app and fail closed when stale.

## Voice: "No speech recognizer available"
Your device lacks a system recognizer (common on de-Googled phones). Text input works everywhere.
Install/enable a system speech service, or use another device. The app never requires a paid voice API.

## Voice: recognition network errors
Android's recognizer may need internet even though the API is on-device. Check connectivity;
transcripts remain editable so you can correct and send by text.

## GitHub device flow fails
- "expired_token": codes live ~15 minutes — start again.
- Make sure your OAuth App has **Device Flow enabled** (github.com/settings/developers).
- The Client ID is public; no secret is needed. Never paste a password anywhere in this app.

## APK won't install
- Enable "Install unknown apps" for your browser/file manager (Settings → Apps → Special access).
- "App not installed" after an update usually means a signing-key mismatch — uninstall the old
  build first (this loses local data; export conversations first).
- Verify the download: compare SHA-256 with the `.sha256` asset on the release page.

## App opens but everything AI-related fails
That's expected with no keys/no network: all local features (history, workspace, notes, image
local editing, settings, error center) still work. The app never crashes just because providers
are down.

## Reset everything
Settings → Privacy & data → Clear ALL local data. Keys are removed separately in Settings.
