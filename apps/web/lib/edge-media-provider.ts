import type { SupabaseClient } from '@supabase/supabase-js';

export type EdgeBinaryResult = {
  bytes: Uint8Array;
  mime: string;
  provider: string;
  model: string;
  latencyMs?: number;
  estimatedCostUsd?: number | null;
  usage?: Record<string, unknown>;
  revisedPrompt?: string | null;
  voice?: string;
};

function fromBase64(value: string) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function edgeImageProviderEnabled() {
  return process.env.USE_SUPABASE_OPENAI_IMAGE === 'true';
}

export function edgeSpeechProviderEnabled() {
  return process.env.USE_SUPABASE_OPENAI_SPEECH === 'true';
}

export async function callEdgeImageProvider(
  supabase: SupabaseClient,
  input: { prompt: string; size?: string; quality?: string; outputFormat?: 'png'|'jpeg'|'webp' },
): Promise<EdgeBinaryResult> {
  const { data, error } = await supabase.functions.invoke('openai-image', { body: input });
  if (error) throw new Error(error.message || 'Supabase image gateway failed');
  if (!data?.b64) throw new Error(data?.error || 'Supabase image gateway returned no image');
  return {
    bytes: fromBase64(data.b64),
    mime: data.mime || 'image/png',
    provider: data.provider || 'openai',
    model: data.model || 'unknown',
    latencyMs: data.latencyMs,
    estimatedCostUsd: data.estimatedCostUsd ?? null,
    usage: data.usage ?? {},
    revisedPrompt: data.revisedPrompt ?? null,
  };
}

export async function callEdgeSpeechProvider(
  supabase: SupabaseClient,
  input: { input: string; voice?: string; responseFormat?: 'mp3'|'opus'|'aac'|'flac'|'wav'|'pcm'; speed?: number; instructions?: string },
): Promise<EdgeBinaryResult> {
  const { data, error } = await supabase.functions.invoke('openai-speech', { body: input });
  if (error) throw new Error(error.message || 'Supabase speech gateway failed');
  if (!data?.b64) throw new Error(data?.error || 'Supabase speech gateway returned no audio');
  return {
    bytes: fromBase64(data.b64),
    mime: data.mime || 'audio/mpeg',
    provider: data.provider || 'openai',
    model: data.model || 'unknown',
    voice: data.voice,
    latencyMs: data.latencyMs,
    estimatedCostUsd: data.estimatedCostUsd ?? null,
    usage: {},
  };
}
