# Privacy — what actually happens to your data

## Stored on your device only (by default)

- Conversations, messages, battles/votes, projects, notes, agent tasks/logs, research reports
- Settings (DataStore) and encrypted provider keys / GitHub token (Keystore-backed vault)
- Error Center diagnostics (max 200 records, 30-day retention, secret-redacted)
- Image assets and agent sandbox files (app-private storage)

`android:allowBackup=false` — the app does not participate in Android cloud backup.

## Sent over the network (only when you act)

| Data | Destination | When |
|---|---|---|
| Chat/agent/research prompts + relevant context | The provider shown in the UI: Pollinations Classic / AI Horde by default; optional Google/Groq/OpenRouter | When you send a message, run a task, or run research |
| Your optional free API key | Only its own provider | On each request to that optional keyed provider |
| Speech audio | Your device's system speech recognizer (which may use its own network service) | When you tap Speak |
| Research queries | Wikipedia API | When you run research |
| GitHub token | github.com / api.github.com | When you use Developer Hub |

**Free-route terms you should know:** No-setup chat sends prompts to third-party services.
Pollinations Classic documents cached results and best-effort service; AI Horde documents that
volunteer workers can see prompts and that IP/usage data is logged. Google's optional Gemini free
tier uses content to improve products. Groq/OpenRouter free routes have their own policies; some
free-model providers train on prompts. The Free AI Access Dashboard shows the privacy note for
every route. Avoid sensitive personal data on all free routes.

## Never done

- No analytics SDKs, no ads, no crash auto-upload, no telemetry.
- No selling or sharing of data with third parties beyond the provider requests you initiate.
- No access to unrelated Google account data. (v0.1.0 has no in-app Google Drive OAuth yet —
  see blockers; the development-session Drive backup is a separate, owner-authorized action.)

## Your controls

- Delete individual conversations/battles/projects/reports, or **Settings → Clear ALL local data**.
- Remove provider keys / disconnect GitHub at any time (encrypted store wiped).
- Error Center: view, copy, export, delete individual records or clear history.
- Model switching disclosure can be disabled (then unavailable-model requests fail honestly).

Deleting local records does not delete copies already processed by a provider; their retention
policies apply. This is stated in the delete dialogs too.
