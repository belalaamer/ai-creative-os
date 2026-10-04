# Phase 7 — Production Resilience & Guardrails

Phase 7 turns the provider layer into a production-oriented execution path rather than a single API call.

## What changed
- Multiple provider candidates per kind/tier (`PRIMARY`, tier default, then up to 3 fallbacks).
- Per-provider retries with exponential backoff.
- Cross-provider automatic failover.
- AbortController request timeouts.
- Organization-level provider spend caps and daily budgets.
- Provider-attempt telemetry and provider health state.
- Brand claim guard for forbidden phrases/claims plus conservative absolute-claim warnings.
- Moderation event audit trail.
- Usage dashboard now includes daily provider budget, spend, retries, failovers, moderation mode, and provider health.

## Provider environment naming
Example for balanced text:

```env
TEXT_QUALITY_PRIMARY_ENDPOINT=
TEXT_QUALITY_PRIMARY_API_KEY=
TEXT_QUALITY_PRIMARY_MODEL=
TEXT_QUALITY_PRIMARY_PROVIDER=
TEXT_QUALITY_PRIMARY_TIMEOUT_MS=90000

TEXT_QUALITY_FALLBACK_1_ENDPOINT=
TEXT_QUALITY_FALLBACK_1_API_KEY=
TEXT_QUALITY_FALLBACK_1_MODEL=
TEXT_QUALITY_FALLBACK_1_PROVIDER=
```

The same naming works for `TEXT`, `IMAGE`, `VOICE` (mapped to `AUDIO` internally), and `VIDEO` tiers. Existing Phase 5 variables remain supported.

## Default organization policy
- Max provider cost per generation: `$3`
- Max provider cost per day: `$25`
- Max credits per day: `1000`
- Retries per provider: `2`
- Failovers: `2`
- Request timeout: `90s`
- Moderation: `enforce`

These defaults are deliberately conservative and should be tuned after real provider pricing is connected.
