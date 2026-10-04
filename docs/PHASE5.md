# Phase 5 — Provider Router + Unit Economics

Phase 5 adds a quality-tier router and unit-economics telemetry.

## Runtime tiers

The creative screen now exposes `Fast`, `Balanced`, and `Ultra`. The server resolves provider credentials by tier, with legacy provider env vars as fallback.

Supported tier prefixes:

- `TEXT_FAST`, `TEXT_QUALITY`, `TEXT_ULTRA`
- `IMAGE_FAST`, `IMAGE_QUALITY`, `IMAGE_ULTRA`
- `VOICE_FAST`, `VOICE_QUALITY`, `VOICE_ULTRA`
- `VIDEO_FAST`, `VIDEO_QUALITY`, `VIDEO_ULTRA`

## Cost tracking

Real provider generations can persist:

- provider/model
- raw usage and latency
- estimated provider cost
- credits billed
- internal credit value
- estimated revenue
- gross margin and margin percentage

Cost persistence uses `SUPABASE_SERVICE_ROLE_KEY` from server-only runtime code. Never expose this key using a `NEXT_PUBLIC_` variable.

## Usage dashboard

`/usage` shows the current wallet balance and provider economics for the latest 100 real-provider generations.

## Database

New tables:

- `provider_routes`
- `provider_health`
- `generation_costs`

RLS is enabled on all three.
