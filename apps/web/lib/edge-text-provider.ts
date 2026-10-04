import type { SupabaseClient } from '@supabase/supabase-js';

export type EdgeTextResult = {
  text: string;
  usage?: Record<string, unknown>;
  provider: string;
  model: string;
  latencyMs?: number;
  estimatedCostUsd?: number | null;
};

export function edgeTextProviderEnabled() {
  return process.env.USE_SUPABASE_OPENAI_TEXT === 'true';
}

export async function callEdgeTextProvider(
  supabase: SupabaseClient,
  input: { system: string; prompt: string; jsonOnly?: boolean; temperature?: number },
): Promise<EdgeTextResult> {
  const { data, error } = await supabase.functions.invoke('openai-text', {
    body: {
      system: input.system,
      prompt: input.prompt,
      jsonOnly: input.jsonOnly ?? false,
      temperature: input.temperature ?? 0.7,
    },
  });
  if (error) throw new Error(error.message || 'Supabase AI gateway failed');
  if (!data?.text) throw new Error(data?.error || 'Supabase AI gateway returned no text');
  return data as EdgeTextResult;
}
