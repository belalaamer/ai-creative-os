# Phase 3 — Video + Voice + Assembly

This phase turns storyboard scenes into production jobs.

## Added
- Arabic/English voiceover generation adapter.
- Async image-to-video jobs with create + polling endpoints.
- `media_jobs` table to persist provider job IDs and state.
- Scene production controls: image, voice, video, produce-all.
- Provider-independent final assembly endpoint.
- Development fallbacks that preserve the complete workflow when providers are not connected.

## Provider contract
The app intentionally uses adapters instead of hard-coding a vendor.

### Voice
Set `VOICE_AI_ENDPOINT`, `VOICE_AI_API_KEY`, `VOICE_AI_MODEL`.
The endpoint may return direct audio bytes, `audio_base64`, or `audio_url`.

### Video
Set `VIDEO_AI_CREATE_ENDPOINT`, `VIDEO_AI_STATUS_ENDPOINT`, `VIDEO_AI_API_KEY`, `VIDEO_AI_MODEL`.
The create endpoint may return a direct video URL or a job/task ID. The status endpoint supports `{jobId}` in its URL.

### Assembly
Set `MEDIA_ASSEMBLY_ENDPOINT` and `MEDIA_ASSEMBLY_API_KEY` for a service that receives a scene timeline and returns a final video URL.
Without it, the system stores an assembly JSON manifest instead of pretending that a rendered MP4 exists.
