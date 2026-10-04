# credits Edge Function

Live Supabase Edge Function: `credits` (JWT required).

Operations:
- `quote`: returns price + wallet balance.
- `charge`: debits the configured action cost atomically with an idempotency key.

The function uses the authenticated user to resolve organization membership and a service-role client to invoke the protected credit ledger function.
