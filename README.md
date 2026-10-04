# AI Creative OS

Arabic-first multi-tenant AI creative platform: brief -> strategy -> scripts -> assets -> final ad.

## Phase 0 scope
- Multi-tenant organizations and membership
- Brand profiles
- Projects
- Credit wallets + immutable ledger
- Workflow/job primitives
- AI provider/model registry
- Generation cost tracking
- RLS-first Supabase schema
- Provider-agnostic TypeScript interfaces

## Proposed stack
- Next.js + TypeScript
- Supabase Postgres/Auth/Storage/Realtime
- Cloudflare Workers/Queues for orchestration
- Provider adapters for text/image/video/voice

## Live status
- Supabase project created and healthy (`eu-central-1`).
- Foundation schema applied.
- Auth bootstrap creates profile + organization + owner membership + wallet.
- Brand Brain schema applied.
- Private asset storage buckets configured.
- Security Advisor currently reports zero findings.

## Next
1. Scaffold the web app auth/onboarding screens.
2. Add the first text-model provider adapter.
3. Implement `creative_brief_v1` workflow.
4. Add controlled credit grants and reservations.
5. Add job queue/orchestrator worker.

## Phase 1 progress
- Arabic/English runtime language switch with RTL/LTR direction.
- Creative Brief v1 UI + API workflow.
- Project, workflow run, step and generation persistence in Supabase.
- Optional external text-provider adapter; safe development fallback when no provider key is configured.
- Storyboard v1 stage with scene duration, shot direction, visual prompts, voiceover and on-screen copy.

## Phase 2 progress
- Scene image generation endpoint added (`/api/generate-image`).
- Arabic/English storyboard UI can generate or regenerate each scene visual.
- “Generate all visuals” runs the full storyboard sequentially.
- Generated files are saved to the private `generation-assets` bucket using organization/project/scene paths.
- Every scene image is persisted in `generations` + `generation_assets` and returned through a short-lived signed URL.
- Optional real image-provider adapter added. If no provider is configured, the app creates a saved 9:16 SVG development preview so the end-to-end asset workflow remains testable.
- Live Supabase write policies for generated assets applied; Security Advisor remains at zero findings.
- Phase 3 environment placeholders are ready for image-to-video.

### Current production pipeline
`Request → Creative Brief → Hooks/Concepts/Script → Storyboard → Visual Prompts → Scene Images → [next: Image-to-Video → Voice → Assembly]`

## Phase 3 — Media Production
Phase 3 adds persisted async media jobs, voiceover adapters, image-to-video adapters, scene polling, and final timeline assembly. The UI now supports per-scene or one-click production. When external providers are missing, development fallbacks are explicit: silent WAV for voice, motion-preview state for video, and a JSON timeline manifest for final assembly.


## Phase 4
Credit engine, 250-credit signup trial, protected Supabase Edge Function for atomic charging, provider-only usage charging, and bilingual Projects/History screens are now implemented. See `docs/PHASE4.md`.

## Phase 5

Provider routing and unit economics are now included. The creative workflow has a Fast / Balanced / Ultra selector. Text, image, voice, and video generation accept the selected quality tier. Real-provider generations can record provider cost, credits, estimated revenue, and gross margin in `generation_costs`. A new `/usage` dashboard exposes these metrics to organization members through RLS.

For production cost telemetry, configure `SUPABASE_SERVICE_ROLE_KEY` only on the server and set per-tier price assumptions in `.env`.

## Phase 6 — Brand Context Engine + Campaign Variants

The platform now has a usable **Brand Brain** editor and a structured context engine. Products/services, active offers, audiences, preferred/forbidden language and forbidden claims are loaded into AI prompts automatically. A frozen `brand_context_snapshots` row is stored with each project so historical generations remain reproducible after the brand changes.

After the Creative Brief, the user can generate **A/B/C campaign variants** with distinct persuasion angles, choose one, and then build the storyboard and downstream image/video production from that selected variant.

New data:
- `brand_context_snapshots`
- `campaign_variants`
- `campaign_variants` credit price (3 credits for a real provider run)

New UI:
- `/brand` Brand Brain management
- A/B/C variant selector in `/creative`
- Saved variants visible in project detail

## Phase 7 — Production Resilience & Guardrails

The provider execution path now supports retries, timeouts and automatic failover across multiple configured providers. Organization policies enforce per-generation and daily provider-cost caps before paid generation. Provider attempts and health are recorded server-side when `SUPABASE_SERVICE_ROLE_KEY` is configured. Brand forbidden claims are checked before text generation and moderation events are retained for audit.

The `/usage` screen now exposes provider health plus daily resilience/budget settings. See `docs/PHASE7.md`.

## Phase 8 — Admin Center & Private Beta Readiness

The app now includes `/settings` for team roles and invitation links, organization AI policy controls, provider routing metadata, subscription status, and production-readiness checks. Workspace switching is supported through `profiles.active_organization_id`, so invited users can move between organizations without changing the generation APIs.

Provider API keys are never written to Postgres or returned to the browser. Settings store only the provider/model route plus an environment-variable prefix; the runtime resolves secrets server-side. Team invitations use random 256-bit tokens and persist only their SHA-256 hash. Sensitive team changes are added to `audit_logs`.

Billing is intentionally a foundation only: trial plan/subscription rows exist, but no fake payment flow is presented as production billing. Connect a real payment provider before enabling paid upgrades.

See `docs/PHASE8.md` for the private-beta gate.

## Phase 9 — Production provider adapters
The provider layer now supports explicit adapters including OpenAI Responses, OpenAI Images, OpenAI Speech, and generic vendor contracts. Production can disable synthetic previews with `ALLOW_DEVELOPMENT_FALLBACK=false`. An admin-only connection-test endpoint records auditable provider test runs, `/api/health` exposes a safe deployment health probe, and CI/Vercel configs are included.

## Phase 10 — Supabase provider isolation

Text-provider secrets can now live entirely inside Supabase Edge Functions. Set `OPENAI_API_KEY` and `OPENAI_TEXT_MODEL` as Supabase project secrets and enable `USE_SUPABASE_OPENAI_TEXT=true` on the web server. Creative Brief, Campaign Variants, and Storyboard then invoke the JWT-protected `openai-text` function instead of reading the OpenAI key from the Next.js runtime.

Two Edge Functions are deployed in the Supabase project:

- `provider-readiness` — secret-presence health check, no secret values are returned.
- `openai-text` — authenticated OpenAI Responses API proxy with usage and optional cost estimation.

## Phase 11

Secure media provider gateways are now available for image generation and speech. Set `USE_SUPABASE_OPENAI_IMAGE=true` and `USE_SUPABASE_OPENAI_SPEECH=true` in the web runtime, while keeping `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, `OPENAI_SPEECH_MODEL`, and optional voice/cost configuration in Supabase Edge Function secrets. See `docs/PHASE11.md`.


## Phase 12 — Secure Video Gateway + Async Final Assembly

Video provider and assembly-service secrets can now stay entirely inside Supabase Edge Functions. The web runtime can enable `USE_SUPABASE_VIDEO_GATEWAY=true` and `USE_SUPABASE_ASSEMBLY_GATEWAY=true`; authenticated requests then call JWT-protected `video-gateway` and `assembly-gateway` functions. Both support immediate results and asynchronous job IDs.

`media_jobs` now records progress, provider status, poll counts, last poll time, and next poll time. Scene video polling and final assembly polling persist finished MP4 files into the private `generation-assets` bucket before charging credits. Production no longer has to expose video or assembly API keys to Next.js. See `docs/PHASE12.md`.
