# Install Ai'sHub on your phone

1. On your phone, open the repository's **Releases** page:
   https://github.com/spideycandy973-web/Ai-sHub/releases
2. Tap `AisHub-v0.1.1.apk` to download it (GitHub may warn about file type — it's an APK).
3. Open the downloaded file. Android may ask to allow installs from your browser/file manager:
   **Settings → Allow from this source → back → Install**.
4. If you already have v0.1.0, install over it. The signing key is unchanged, so your local
   conversations and settings are preserved.
5. Open **Ai'sHub** → **Chat** → tap **+** → type a message → send.

**No API key, account, or configuration is required for normal chat.**

## If a reply is slow or fails

- Free anonymous AI services are best effort. Pollinations Classic is rate-limited per IP
  (one text request at a time, at least 30 seconds apart). AI Horde uses volunteer workers and
  may queue or be unavailable under load.
- Wait a little and tap retry. The app automatically tries another eligible free route when it
  can. It never asks for payment.
- You can open **Free AI Access** from the menu to see route status and run a small live check.

## Optional advanced keys (not required)

Settings → Optional advanced keys lets you add your own free-tier Gemini/Groq/OpenRouter key.
This is optional and never unlocks paid routes.

## Verify your download (optional)

Each release ships a `.sha256` file. Compare the APK digest with the published one.

## If installation fails

- "App not installed": usually a signature mismatch with a previously installed build from a
  different key. Export conversations if needed, uninstall the old app, install the new one.
- "Parse error": the download was incomplete — re-download and check the SHA-256.
- Play Protect may show "Unknown app" for sideloaded APKs — expected outside the Play Store.
