# Live Supabase

Project: `AI Creative OS`
Project ref: `qsyjddhfzahhdwmkcbiv`
Region: `eu-central-1`
URL: `https://qsyjddhfzahhdwmkcbiv.supabase.co`

## Applied foundation

- Multi-tenant organizations + memberships
- Profiles + automatic signup bootstrap
- Brand Brain: brands, products, audiences, offers, guidelines, assets
- Projects
- Credit wallets + ledger
- Workflow runs + steps
- Generation tracking + cost fields
- AI provider/model registry
- Private `brand-assets` and `generation-assets` buckets
- RLS enabled on application tables
- Security Advisor: zero findings after hardening

## Signup bootstrap

A new `auth.users` row automatically creates:

1. `profiles` row
2. personal organization
3. owner membership
4. zero-balance credit wallet

Initial promotional/trial credits are intentionally not hard-coded into the database trigger; they should be granted by a controlled billing/onboarding service with an idempotency key.
