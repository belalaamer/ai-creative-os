# Phase 12 — Secure Video + Final Assembly

## What changed

- Added JWT-protected `video-gateway` Supabase Edge Function.
- Added JWT-protected `assembly-gateway` Supabase Edge Function.
- Both support immediate provider results or async provider job IDs.
- Video scene polling now supports the secure gateway and persists the final MP4 to private storage.
- Final assembly can now be asynchronous and is polled through `/api/assembly-jobs/[id]`.
- `media_jobs` tracks `progress`, `provider_status`, `poll_count`, `last_polled_at`, and `next_poll_at`.
- Provider readiness now reports video and assembly secret presence without returning any secret values.

## Web environment

```env
USE_SUPABASE_VIDEO_GATEWAY=true
USE_SUPABASE_ASSEMBLY_GATEWAY=true
```

## Supabase Edge secrets

### Video

```env
VIDEO_PROVIDER_API_KEY=...
VIDEO_PROVIDER_CREATE_ENDPOINT=...
VIDEO_PROVIDER_STATUS_ENDPOINT=...
VIDEO_PROVIDER_MODEL=...
VIDEO_PROVIDER_NAME=...
VIDEO_PROVIDER_UNIT_COST_USD=...
```

The gateway sends a generic image-to-video body containing `model`, `prompt`, `image_url`, `duration`, and `aspect_ratio`. Adapt the Edge Function if a chosen provider uses a materially different contract.

### Final assembly

```env
MEDIA_ASSEMBLY_ENDPOINT=...
MEDIA_ASSEMBLY_STATUS_ENDPOINT=...
MEDIA_ASSEMBLY_API_KEY=...
MEDIA_ASSEMBLY_PROVIDER_NAME=...
MEDIA_ASSEMBLY_MODEL=...
MEDIA_ASSEMBLY_UNIT_COST_USD=...
```

The assembly service receives scene video/audio/subtitle metadata and should return either a final video URL or an async job ID.

## Security

Provider secrets are never returned by readiness endpoints, written to Postgres, or exposed as `NEXT_PUBLIC_*`. Final assets are downloaded server-side and stored in the private Supabase `generation-assets` bucket.
