# Creative OS V2 API — Railway

This deploy target runs the pinned Nalarin FastAPI backend used by the V2 Ads Center.

Required runtime variables:

- `DATABASE_URL` — Railway PostgreSQL connection string.
- `SECRET_KEY` — strong random application secret.
- `OAUTH_TOKEN_ENCRYPTION_KEY` — Fernet-compatible encryption key required by the upstream backend.
- `ALLOWED_ORIGINS` — include `https://ai-creative-os-v2-ads.pages.dev`.
- `FRONTEND_URL` — `https://ai-creative-os-v2-ads.pages.dev`.

Optional provider variables can be added later for Meta, Google Ads, TikTok, Gemini/FAL/KIE and R2. The service runs migrations plus idempotent role/permission seeding before starting Uvicorn.
