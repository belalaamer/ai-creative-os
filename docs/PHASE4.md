# Phase 4 — Credits + Project History

Implemented:
- Credit price catalog in Postgres.
- 250-credit signup trial for new workspaces.
- Protected atomic credit ledger mutations (service-role only).
- JWT-protected `credits` Supabase Edge Function with quote + idempotent charge operations.
- Provider-backed generations check available balance before calling providers and charge only after successful provider output.
- Development fallback outputs remain free.
- Project history page with generated assets, provider/model status and credits used.
- Per-project detail page with signed image/audio/video previews.

Current price defaults:
- Creative Brief: 2
- Storyboard: 2
- Scene image: 8
- Scene voiceover: 4
- Scene video: 40
- Final assembly: 10

These are product credits, not provider-dollar prices. They can be changed in `credit_prices` without changing UI code.
