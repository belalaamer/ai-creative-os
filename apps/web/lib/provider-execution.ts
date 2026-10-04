import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeQuality, resolveProviderCandidates, type ProviderConfig, type ProviderKind } from './provider-router';
import { executeWithFailover } from './resilience';
import { enforceBudget, loadAiPolicy } from './production-guard';
import { recordProviderAttempt } from './provider-telemetry';

export async function runProviderCandidates<T>(input:{
  supabase:SupabaseClient;
  organizationId:string;
  generationId?:string;
  mediaJobId?:string;
  kind:ProviderKind;
  quality:unknown;
  expectedUnits?:number;
  run:(provider:ProviderConfig,signal:AbortSignal)=>Promise<T>;
}){
  const quality=normalizeQuality(input.quality);
  const candidates=await resolveProviderCandidates(input.supabase,input.organizationId,input.kind,quality);
  if(!candidates.length)return null;
  const policy=await loadAiPolicy(input.supabase,input.organizationId);
  enforceBudget(policy,candidates,input.expectedUnits??1);
  const executed=await executeWithFailover({
    candidates,
    maxRetriesPerProvider:policy.max_retries_per_provider,
    maxFailovers:policy.max_failovers,
    timeoutMs:policy.request_timeout_ms,
    run:input.run,
    onAttempt:async(meta)=>{
      await recordProviderAttempt({organizationId:input.organizationId,generationId:input.generationId,mediaJobId:input.mediaJobId,kind:input.kind,quality,provider:meta.provider,model:meta.model,attempt:meta.attempt,status:meta.status,latencyMs:meta.latencyMs,error:meta.error});
    }
  });
  return {...executed,policy,quality};
}
