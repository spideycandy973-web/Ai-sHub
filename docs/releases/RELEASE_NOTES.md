# Ai'sHub v0.1.1 — zero-setup chat

**Package:** `com.aishub` · **versionName:** 0.1.1 · **versionCode:** 2 · min Android 8.0 (API 26), target API 35

## The change you asked for

Open the app, type a message, get a real AI reply. **No API key. No account. No setup.**

Normal Chat now defaults to free anonymous routes:

1. **Pollinations Classic** — `openai-fast` (GPT-OSS 20B), free/no-signup, rate-limited.
2. **AI Horde** — anonymous volunteer workers, automatic online-model selection, free/no-signup.

If the first route is busy or rate-limited, the router tries the next eligible free route and
shows a switch notice. If all free routes are unavailable, the app says so honestly. It never
asks for payment and never falls back to a paid model.

Optional Gemini/Groq/OpenRouter free-tier keys remain in Settings as an advanced option, but
they are **not required** for basic chat.

## Verified for this release

- 40/40 JVM unit tests pass locally (routing policy, zero-setup adapters, redaction, sandbox paths).
- Live anonymous smoke tests succeeded without any user account/key:
  - Pollinations Classic returned `Hey! How's it going?` from `gpt-oss-20b`.
  - AI Horde returned `Hey there!` from `koboldcpp/gemma-4-E4B-it` with **no Authorization header**.
- Debug APK built locally. Signed release APK is built by CI with the same release key as v0.1.0.

## Known limitations

- Free anonymous services are best effort. Pollinations Classic allows one text request at a
  time per IP and at least 30 seconds apart; AI Horde depends on volunteer workers and queues.
- Prompts leave the device. Pollinations may cache results; AI Horde volunteer workers can see
  prompts and the service logs IP/usage data. Do not send passwords or sensitive personal data.
- AI image generation remains blocked (no verified free hosted image route). General web search
  remains Wikipedia-only. Bengali translation is not complete.

## Install / update

Download `AisHub-v0.1.1.apk` from Releases and install over v0.1.0. The signing key is unchanged,
so local data is preserved. See [INSTALL.md](INSTALL.md).
