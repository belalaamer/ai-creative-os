import { createClient } from '@supabase/supabase-js';

export async function recordGenerationCost(params: {
  generationId: string;
  organizationId: string;
  providerCode: string;
  modelCode: string;
  providerCostUsd?: number;
  billableCredits: number;
  rawUsage?: Record<string, unknown>;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return;

  const creditValue = Number(process.env.INTERNAL_CREDIT_VALUE_USD || '0.01');
  const revenue = params.billableCredits * creditValue;
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.from('generation_costs').upsert({
    generation_id: params.generationId,
    organization_id: params.organizationId,
    provider_code: params.providerCode,
    model_code: params.modelCode,
    provider_cost_usd: params.providerCostUsd ?? 0,
    billable_credits: params.billableCredits,
    internal_credit_value_usd: creditValue,
    revenue_usd: revenue,
    raw_usage: params.rawUsage ?? {},
  }, { onConflict: 'generation_id' });
  if (error) console.error('generation_costs insert failed', error.message);
}
