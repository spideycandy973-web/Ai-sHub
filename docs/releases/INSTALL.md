# Install Ai'sHub on your phone

1. On your phone, open the repository's **Releases** page:
   https://github.com/spideycandy973-web/Ai-sHub/releases
2. Tap `AisHub-vX.Y.Z.apk` to download it (GitHub may warn about file type — it's an APK).
3. Open the downloaded file. Android will ask to allow installs from your browser/file
   manager: **Settings → Allow from this source → back → Install**.
4. Open **Ai'sHub**. All local features work immediately.
5. To enable AI: **Settings → Free provider keys → Add key** for at least one provider:
   - Gemini: aistudio.google.com/api-keys (sign in with Google, Create API key — free, no card)
   - Groq: console.groq.com/keys
   - OpenRouter: openrouter.ai/settings/keys
6. Open **Free AI Access** (menu) → tap **Live check** on a provider to verify it really works
   with your key, then start chatting.

## Updating

Download the newer APK from Releases and install over the old one — data is preserved as long
as the signing key is unchanged (it is; the key is backed up privately).

## Verify your download (optional but recommended)

Each release ships a `.sha256` file. In a file manager app with checksum support (or Termux:
`sha256sum AisHub-vX.Y.Z.apk`), compare the digest with the published one.

## If installation fails

- "App not installed": usually a signature mismatch with a previously installed build from a
  different key — export your conversations, uninstall the old app, install the new one.
- "Parse error": the download was incomplete — re-download (check the SHA-256).
- Play Protect may show "Unknown app" for sideloaded APKs — this is expected outside the Play
  Store; verify the source is this repository's Releases page.
