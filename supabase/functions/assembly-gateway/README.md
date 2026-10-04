# assembly-gateway

JWT-protected generic final video assembly gateway. It forwards scene video/audio/subtitle metadata to a server-side assembly service without exposing the service key to the browser.

Required secrets:
- `MEDIA_ASSEMBLY_ENDPOINT`
- `MEDIA_ASSEMBLY_API_KEY`

Optional async support:
- `MEDIA_ASSEMBLY_STATUS_ENDPOINT`
- `MEDIA_ASSEMBLY_STATUS_METHOD`

Optional metadata/cost:
- `MEDIA_ASSEMBLY_PROVIDER_NAME`
- `MEDIA_ASSEMBLY_MODEL`
- `MEDIA_ASSEMBLY_UNIT_COST_USD`
- `MEDIA_ASSEMBLY_AUTH_HEADER`
- `MEDIA_ASSEMBLY_AUTH_PREFIX`
