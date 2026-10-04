import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProviderConfig } from './provider-router';

export type AiPolicy = {
  spent_provider_usd_today: number;
  spent_credits_today: number;
  max_provider_cost_per_generation_usd: number;
  max_provider_cost_per_day_usd: number;
  max_credits_per_day: number;
  max_retries_per_provider: number;
  max_failovers: number;
  request_timeout_ms: number;
  moderation_mode: 'off'|'warn'|'enforce';
};

export async function loadAiPolicy(supabase: SupabaseClient, organizationId: string): Promise<AiPolicy> {
  const { data, error } = await supabase.rpc('provider_budget_snapshot', { p_organization_id: organizationId });
  if (error) throw error;
  return {
    spent_provider_usd_today:Number(data?.spent_provider_usd_today ?? 0),
    spent_credits_today:Number(data?.spent_credits_today ?? 0),
    max_provider_cost_per_generation_usd:Number(data?.max_provider_cost_per_generation_usd ?? 3),
    max_provider_cost_per_day_usd:Number(data?.max_provider_cost_per_day_usd ?? 25),
    max_credits_per_day:Number(data?.max_credits_per_day ?? 1000),
    max_retries_per_provider:Number(data?.max_retries_per_provider ?? 2),
    max_failovers:Number(data?.max_failovers ?? 2),
    request_timeout_ms:Number(data?.request_timeout_ms ?? 90000),
    moderation_mode:(data?.moderation_mode ?? 'enforce') as AiPolicy['moderation_mode'],
  };
}

export function enforceBudget(policy: AiPolicy, candidates: ProviderConfig[], expectedUnits = 1) {
  const knownCosts = candidates.map((c) => c.unitCostUsd == null ? undefined : c.unitCostUsd * expectedUnits).filter((x): x is number => x != null);
  const expected = knownCosts.length ? Math.min(...knownCosts) : undefined;
  if (expected != null && expected > policy.max_provider_cost_per_generation_usd) throw new Error('provider_cost_cap_exceeded');
  if (expected != null && policy.spent_provider_usd_today + expected > policy.max_provider_cost_per_day_usd) throw new Error('daily_provider_budget_exceeded');
}
