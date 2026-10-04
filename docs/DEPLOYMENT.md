# Private Beta Deployment Checklist

1. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Set `SUPABASE_SERVICE_ROLE_KEY` only in the server environment.
3. Set `APP_URL` to the canonical deployment URL.
4. Configure at least one real text provider; for custom workspace routes, store only `env_prefix`, provider and model in Settings, then create `<PREFIX>_ENDPOINT` and `<PREFIX>_API_KEY` on the server.
5. Configure image, audio and video providers before enabling those production tools.
6. Configure `MEDIA_ASSEMBLY_ENDPOINT` / `MEDIA_ASSEMBLY_API_KEY` for a real final video output.
7. Connect a real billing provider before enabling paid plan upgrades. `BILLING_PROVIDER_SECRET` is only a readiness placeholder in Phase 8.
8. Run `npm install`, `npm run typecheck`, and `npm run build` in an environment with package registry access.
9. Verify `/settings` → Production readiness and run a complete test project in both Arabic and English.
10. Confirm Supabase Security Advisor has no unresolved findings before launch.
