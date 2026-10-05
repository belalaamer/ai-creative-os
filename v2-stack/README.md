# Creative OS V2 — Nalarin + two-71 Studio

This is the selected V2 direction after deeper comparison.

## Core stack
- Nalarin Agentic Ads Studio — Meta/Google/TikTok Ads operations, OAuth, multi-account paid media, competitor research, AI creative generation, approval guardrails, white-label. MIT.
  - Pinned commit: c500cc5a132142ff3de815bf6d15c50d490ea522
- two-71 Studio — installable Next.js image/video generation studio with realtime progress, gallery, image-to-video, references, LoRAs, pluggable auth/billing/storage. MIT.
  - Pinned commit: e2f24f414f0cc6401e269dd98c7f6e07be8d0d98

## Existing Creative OS services retained
- Supabase organizations/auth/credits/security
- Brand Brain data model
- Arabic/English localization
- Existing production domain and account data

## Integration rule
Nalarin is the paid-media operations backend/reference. two-71 is the media generation surface. Existing Creative OS remains the identity/tenant/billing layer.

We are not using OpenAdKit or Sobe Tudo as the primary V2 base. They may still be mined selectively for isolated ideas where useful.


## Preview infrastructure

- Ads Center (Nalarin frontend): https://ai-creative-os-v2-ads.pages.dev
- Studio preview URL reserved in frontend config: https://ai-creative-os-v2-studio.pages.dev

The Ads Center is deployed from this branch through Cloudflare Pages. Its API points to the planned V2 backend endpoint until the backend service is provisioned.
