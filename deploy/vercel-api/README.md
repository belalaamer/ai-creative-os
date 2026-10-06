# Creative OS V2 API on Vercel

Project: `ai-creative-os-v2-api`. Root Directory must be the repository root.
Vercel detects `Dockerfile.vercel`; it contains the same pinned Nalarin,
Chromium, dependencies and migration compatibility fixes as the tested image.
The existing Cloudflare website remains the frontend until the API passes live checks.

## Runtime configuration

Set private values through the Vercel environment-variable settings:

- `DATABASE_URL`: a **dedicated Nalarin PostgreSQL database**, using a direct
  connection or session pooler. Do not point upstream migrations at Creative OS's
  existing public schema, and do not use transaction pooling: startup uses a
  PostgreSQL session advisory lock to serialize migrations and role seeding.
- `SECRET_KEY`, `OAUTH_TOKEN_ENCRYPTION_KEY`: application signing/Fernet keys.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
  `R2_PUBLIC_URL`: durable storage. Templates and generated images use R2;
  startup refuses to silently rely on ephemeral local files.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: set together to create the initial admin.
- `PORT=80`, `ALLOWED_ORIGINS=https://ai-creative-os-v2-ads.pages.dev,https://ai-creative-os.belalaamer.workers.dev`,
  `FRONTEND_URL=https://ai-creative-os-v2-ads.pages.dev`.

Add Meta/provider credentials after basic health/login is verified. The Meta
redirect is `https://<api-domain>/api/v1/facebook/oauth/callback`; register the
exact URL in the Meta developer application.

## Activation checks

Run the existing `scripts/v2-stack/smoke-api.py` against the deployed API using
a dedicated account, then test R2 uploads, template uploads, generation and
competitor scraping. Enable live frontend mode only after these checks pass.

Vercel containers scale to zero and obey function duration and request-body
limits. Production activation still requires validation of the long scraping
jobs and a direct-to-object-storage upload path for media larger than the
function request-body limit. The container build is not proof of full feature
parity on Vercel; keep the preview banner until runtime validation is complete.

Never put database passwords or provider keys in source, GitHub comments, or
chat. If deployment returns an authentication wall, verify protected previews
with a supported bypass; do not disable preview protection to test.
