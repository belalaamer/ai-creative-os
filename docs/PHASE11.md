# Phase 11 — Secure Image + Speech Gateways

Phase 11 moves image generation and text-to-speech provider secrets into JWT-protected Supabase Edge Functions, matching the secure text gateway introduced in Phase 10.

## New Edge Functions

- `openai-image`
- `openai-speech`
- `provider-readiness` v2

The web app only carries feature flags. Provider secrets remain in Supabase Edge Function secrets.

### Required Supabase secrets

```bash
OPENAI_API_KEY=...
OPENAI_IMAGE_MODEL=...
OPENAI_SPEECH_MODEL=...
OPENAI_SPEECH_VOICE=alloy
```

Optional cost telemetry:

```bash
OPENAI_IMAGE_UNIT_COST_USD=...
OPENAI_SPEECH_COST_PER_1K_CHARS_USD=...
```

### Web flags

```bash
USE_SUPABASE_OPENAI_IMAGE=true
USE_SUPABASE_OPENAI_SPEECH=true
```

## Image gateway

`openai-image` calls OpenAI's image generation endpoint and returns base64 image data plus model/provider metadata, latency, usage, and optional estimated cost.

## Speech gateway

`openai-speech` calls OpenAI's speech endpoint and returns base64 audio data plus model/provider metadata, voice, latency, and optional estimated cost.

## Production behavior

When `ALLOW_DEVELOPMENT_FALLBACK=false`, missing or failing providers surface as errors instead of synthetic preview assets.
