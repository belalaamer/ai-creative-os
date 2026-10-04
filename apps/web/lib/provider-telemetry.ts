import { createClient } from '@supabase/supabase-js';
import type { ProviderKind, QualityTier } from './provider-router';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}) : null;
}

export async function recordProviderAttempt(input:{
  organizationId:string; generationId?:string; mediaJobId?:string; kind:ProviderKind; quality:QualityTier;
  provider:string; model:string; attempt:number; status:'started'|'succeeded'|'failed'|'timed_out'|'skipped_budget'|'blocked_moderation';
  latencyMs?:number; error?:string; estimatedCostUsd?:number;
}) {
  const admin=adminClient(); if(!admin)return;
  await admin.from('provider_attempts').insert({
    organization_id:input.organizationId,generation_id:input.generationId??null,media_job_id:input.mediaJobId??null,
    kind:input.kind,quality_tier:input.quality,provider_code:input.provider,model_code:input.model,attempt_no:input.attempt,
    status:input.status,latency_ms:input.latencyMs??null,error_message:input.error??null,estimated_cost_usd:input.estimatedCostUsd??null,
    finished_at:input.status==='started'?null:new Date().toISOString()
  });

  if(input.status==='succeeded'){
    await admin.from('provider_health').upsert({provider_code:input.provider,status:'healthy',consecutive_failures:0,last_success_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'provider_code'});
  } else if(input.status==='failed'||input.status==='timed_out') {
    const {data:health}=await admin.from('provider_health').select('consecutive_failures').eq('provider_code',input.provider).maybeSingle();
    const failures=Number(health?.consecutive_failures??0)+1;
    await admin.from('provider_health').upsert({provider_code:input.provider,status:failures>=3?'degraded':'unknown',consecutive_failures:failures,last_failure_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'provider_code'});
  }
}

export async function recordModerationEvent(input:{organizationId:string;projectId?:string;generationId?:string;userId?:string;ruleKey:string;severity:'info'|'warning'|'block';matchedText?:string;details?:Record<string,unknown>}){
  const admin=adminClient(); if(!admin)return;
  await admin.from('moderation_events').insert({organization_id:input.organizationId,project_id:input.projectId??null,generation_id:input.generationId??null,event_type:'claim_guard',severity:input.severity,rule_key:input.ruleKey,matched_text:input.matchedText??null,details:input.details??{},created_by:input.userId??null});
}
