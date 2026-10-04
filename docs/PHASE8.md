# Phase 8 — Admin Center & Private Beta Readiness

This phase turns the project into an operable multi-tenant SaaS shell.

## Added
- Active workspace selection for users belonging to multiple organizations.
- Admin Center with team, AI policy, provider routing metadata, billing status and readiness checks.
- Team invitations with 7-day signed random tokens; only a SHA-256 hash is stored.
- Role management for admin/editor/viewer. Owner cannot be demoted or removed through the ordinary member API.
- Billing plan/subscription foundation. Payment processing is deliberately not simulated; a real billing provider must be connected later.
- Provider settings store only routing metadata and environment-variable prefixes. API secrets never enter the browser or database.
- Audit log table for sensitive team actions.
- Production readiness endpoint that returns booleans only; it never returns secret values.

## Private beta gate
At minimum configure APP_URL, Supabase public variables, SUPABASE_SERVICE_ROLE_KEY, and one real text provider before calling the deployment private-beta ready.
