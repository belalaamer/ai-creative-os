# openai-text Edge Function

This function is deployed with JWT verification enabled. It reads `OPENAI_API_KEY` and `OPENAI_TEXT_MODEL` only from Supabase Edge Function secrets and calls the OpenAI Responses API server-side. The browser never receives the provider API key.

Set the optional cost-rate secrets if you want per-generation cost estimation:

- `OPENAI_TEXT_INPUT_COST_PER_MILLION_USD`
- `OPENAI_TEXT_OUTPUT_COST_PER_MILLION_USD`

Then set `USE_SUPABASE_OPENAI_TEXT=true` in the Next.js server environment.
