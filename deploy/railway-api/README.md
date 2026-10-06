# Creative OS V2 API — Railway

This deploy target runs the pinned Nalarin FastAPI backend used by the V2 Ads Center.

Required runtime variables:

- `DATABASE_URL` — Railway PostgreSQL connection string.
- `SECRET_KEY` — strong random application secret.
- `OAUTH_TOKEN_ENCRYPTION_KEY` — Fernet-compatible encryption key required by the upstream backend.
- `ALLOWED_ORIGINS` — include `https://ai-creative-os-v2-ads.pages.dev`.
- `FRONTEND_URL` — `https://ai-creative-os-v2-ads.pages.dev`.

Optional provider variables can be added later for Meta, Google Ads, TikTok, Gemini/FAL/KIE and R2. The service runs migrations plus idempotent role/permission seeding before starting Uvicorn.

The container validates the OAuth encryption key before migrations, applies Alembic migrations, and seeds roles without bypassing migrations with `create_all`. Optional `ADMIN_EMAIL` and `ADMIN_PASSWORD` create the initial administrator. Keep these values in the deployment secret store.

Meta connection additionally requires `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, and `FACEBOOK_OAUTH_REDIRECT_URI` matching the callback on the deployed API and registered in the Meta developer app. The Ads Center must be rebuilt with `VITE_DEMO_MODE=false` and `VITE_API_URL=https://<api-host>/api/v1` only after API health and login are verified. Its current sample campaigns are preview data.

Deployment regression checks: `python3 -m unittest discover -s tests/v2 -v`.
