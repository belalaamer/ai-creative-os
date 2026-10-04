import type { SupabaseClient } from '@supabase/supabase-js';

export type EdgeVideoResult = {
  status: 'processing' | 'succeeded' | 'failed';
  jobId?: string | null;
  videoUrl?: string | null;
  progress?: number | null;
  provider: string;
  model: string;
  latencyMs?: number;
  estimatedCostUsd?: number | null;
  rawStatus?: string | null;
};

export function edgeVideoGatewayEnabled() {
  return process.env.USE_SUPABASE_VIDEO_GATEWAY === 'true';
}

export function edgeAssemblyGatewayEnabled() {
  return process.env.USE_SUPABASE_ASSEMBLY_GATEWAY === 'true';
}

function normalize(data: any): EdgeVideoResult {
  const status = data?.status === 'succeeded' || data?.status === 'failed' ? data.status : 'processing';
  return {
    status,
    jobId: data?.jobId ?? null,
    videoUrl: data?.videoUrl ?? null,
    progress: typeof data?.progress === 'number' ? data.progress : null,
    provider: data?.provider || 'secure-media-gateway',
    model: data?.model || 'unknown',
    latencyMs: data?.latencyMs,
    estimatedCostUsd: data?.estimatedCostUsd ?? null,
    rawStatus: data?.rawStatus ?? null,
  };
}

export async function callEdgeVideoCreate(
  supabase: SupabaseClient,
  input: { prompt: string; imageUrl: string; durationSeconds?: number; aspectRatio?: string },
): Promise<EdgeVideoResult> {
  const { data, error } = await supabase.functions.invoke('video-gateway', {
    body: { action: 'create', ...input },
  });
  if (error) throw new Error(error.message || 'Secure video gateway failed');
  if (data?.error) throw new Error(data.error);
  return normalize(data);
}

export async function callEdgeVideoStatus(
  supabase: SupabaseClient,
  jobId: string,
): Promise<EdgeVideoResult> {
  const { data, error } = await supabase.functions.invoke('video-gateway', {
    body: { action: 'status', jobId },
  });
  if (error) throw new Error(error.message || 'Secure video status gateway failed');
  if (data?.error) throw new Error(data.error);
  return normalize(data);
}

export async function callEdgeAssemblyCreate(
  supabase: SupabaseClient,
  input: { scenes: unknown[]; locale?: string; aspectRatio?: string; subtitles?: boolean },
): Promise<EdgeVideoResult> {
  const { data, error } = await supabase.functions.invoke('assembly-gateway', {
    body: { action: 'create', ...input },
  });
  if (error) throw new Error(error.message || 'Secure assembly gateway failed');
  if (data?.error) throw new Error(data.error);
  return normalize(data);
}

export async function callEdgeAssemblyStatus(
  supabase: SupabaseClient,
  jobId: string,
): Promise<EdgeVideoResult> {
  const { data, error } = await supabase.functions.invoke('assembly-gateway', {
    body: { action: 'status', jobId },
  });
  if (error) throw new Error(error.message || 'Secure assembly status gateway failed');
  if (data?.error) throw new Error(data.error);
  return normalize(data);
}
