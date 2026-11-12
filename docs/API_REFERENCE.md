# API Reference (v0.1.0)

v0.1.0 has **no custom backend API** (see ARCHITECTURE.md for the decision). This document
specifies the external APIs the app consumes and the internal contracts it exposes.

## Internal contracts (Kotlin)

### ProviderAdapter
```kotlin
interface ProviderAdapter {
    suspend fun generate(route: ModelRoute, request: GenerationRequest, apiKey: String): GenerationResult
    fun stream(route: ModelRoute, request: GenerationRequest, apiKey: String): Flow<StreamChunk>
    suspend fun healthCheck(route: ModelRoute, apiKey: String): Result<String>
}
```
- `GenerationResult` always carries `actualModelId` (from the provider response, not the request).
- Errors are typed: `Auth`, `RateLimited(retryAfter)`, `QuotaExhausted`, `Unavailable`,
  `Malformed`, `Unsupported`, `NoEligibleRoute`, `MissingKey`.

### Agent ToolCall (model → engine, JSON)
```json
{"tool":"write_file","path":"relative/path","content":"..."}
{"tool":"read_file","path":"..."} {"tool":"list_files"} {"tool":"search","query":"..."} {"tool":"done","content":"..."}
```
Parsed strictly; unknown tools rejected; sandbox + mode policy enforced by the engine.

### Conversation export format (`aishub-conversation-v1`)
```json
{"format":"aishub-conversation-v1","title":"...","exportedAt":1730000000000,
 "messages":[{"role":"user","text":"...","createdAt":0,"model":"","provider":""}]}
```
Never includes keys, tokens, or hidden credentials.

## External APIs consumed

| API | Endpoint | Auth | Notes |
|---|---|---|---|
| Gemini Developer API | `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` / `:streamGenerateContent?alt=sse` | `x-goog-api-key` header (user's free key) | SSE streaming; usage metadata parsed |
| Groq | `api.groq.com/openai/v1/chat/completions` | Bearer (user's free key) | OpenAI-compatible SSE |
| OpenRouter | `openrouter.ai/api/v1/chat/completions` | Bearer (user's free key) | Only `openrouter/free` model ID is ever sent |
| GitHub OAuth device flow | `github.com/login/device/code`, `github.com/login/oauth/access_token` | Public client ID (user's OAuth App) | No client secret |
| GitHub REST | `api.github.com` (repos, contents, releases, actions/runs, branches) | Bearer (device-flow token, vault-encrypted) | `X-GitHub-Api-Version: 2022-11-28` |
| Wikipedia | `en.wikipedia.org/w/api.php` (search, extracts) | None (official free API) | Sequential, bounded queries; UA identifies the app |

## Error surface

All provider errors are classified, redacted (`Redactor`), recorded in the Error Center with
category/module/timestamp/app-version, and shown honestly in the UI. HTTP 402 never triggers a
payment path — it suspends the route.
