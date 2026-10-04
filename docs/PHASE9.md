# Phase 9 — Production provider adapters & release engineering

## Added
- Explicit provider adapter layer (`generic`, `openai-responses`, `openai-images`, `openai-speech`).
- OpenAI Responses-compatible text adapter while preserving generic chat-completions providers.
- Image and voice binary adapters with URL/base64/direct-binary handling.
- Admin-only provider connection test endpoint with auditable `provider_test_runs`.
- Public `/api/health` endpoint that never exposes secrets.
- `ALLOW_DEVELOPMENT_FALLBACK` production safety switch.
- GitHub Actions CI for typecheck + Next build.
- Vercel project config.

## Production rule
Set `ALLOW_DEVELOPMENT_FALLBACK=false` in production. Development previews are useful locally, but production should fail clearly when a paid provider is unavailable rather than silently return synthetic assets.

## OpenAI text example
Use the Responses API endpoint with `*_ADAPTER=openai-responses`. Keep the API key server-side only.
