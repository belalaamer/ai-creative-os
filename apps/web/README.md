# AI Creative OS Web

Next.js Arabic-first web client for auth, onboarding, Brand Brain and dashboard.

## Run
1. Copy `.env.example` to `.env.local`.
2. `npm install` from repo root.
3. `npm run dev --workspace=@ai-creative-os/web`

## Current user flow
`/auth` -> Supabase Auth -> automatic organization bootstrap -> `/onboarding` -> brand creation -> `/dashboard`.
