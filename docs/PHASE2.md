# Phase 2 — Visual Production

## What works

1. A signed-in user creates a Creative Brief.
2. The system stores a Project, Workflow Run, Step and Text Generation.
3. The user generates a Storyboard.
4. Each scene can be converted into an image-generation request.
5. The image result is uploaded to the private Supabase `generation-assets` bucket.
6. Asset metadata is stored in `generation_assets` and linked to the parent image generation.
7. The client receives a one-hour signed URL for preview.

## Provider contract

Set these server-only variables:

- `IMAGE_AI_ENDPOINT`
- `IMAGE_AI_API_KEY`
- `IMAGE_AI_MODEL`
- `IMAGE_AI_QUALITY`

The current adapter sends `model`, `prompt`, `size=1024x1536` and `quality`. It accepts image data as `data[0].b64_json`, `data[0].url`, `image_base64`, `image_url`, `b64_json`, or `url`.

If the variables are missing or the external provider fails, a development SVG is generated and stored instead. This is intentionally obvious in the UI and is not presented as an AI-generated image.

## Security

- Storage buckets remain private.
- Asset paths begin with the organization UUID.
- Storage RLS verifies membership/role from that UUID.
- Database RLS verifies that the parent generation belongs to an organization where the user is an owner/admin/editor.
- Provider API keys stay server-side.

## Phase 3

- Provider-specific image-to-video adapters.
- Async video job polling.
- Voice generation.
- Final assembly and subtitle tracks.
- Credit reservation/settlement based on real provider cost.
