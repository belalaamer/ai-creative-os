# video-gateway

JWT-protected generic image-to-video gateway. Provider secrets stay in Supabase Edge Function secrets.

Required secrets:
- `VIDEO_PROVIDER_API_KEY`
- `VIDEO_PROVIDER_CREATE_ENDPOINT`
- `VIDEO_PROVIDER_MODEL`

Recommended for async providers:
- `VIDEO_PROVIDER_STATUS_ENDPOINT` — may include `{jobId}`; otherwise the job id is appended.

Optional:
- `VIDEO_PROVIDER_NAME`
- `VIDEO_PROVIDER_STATUS_METHOD` (`GET` by default)
- `VIDEO_PROVIDER_AUTH_HEADER` (`Authorization` by default)
- `VIDEO_PROVIDER_AUTH_PREFIX` (`Bearer ` by default)
- `VIDEO_PROVIDER_UNIT_COST_USD`
