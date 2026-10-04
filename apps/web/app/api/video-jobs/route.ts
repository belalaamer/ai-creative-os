import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chargeCredits, isCreditError, quoteCredits } from '@/lib/credits-server';
import { estimateUnitCostUsd, resolveProviderCandidates, normalizeQuality } from '@/lib/provider-router';
import { runProviderCandidates } from '@/lib/provider-execution';
import { recordGenerationCost } from '@/lib/generation-costs';
import { developmentFallbackAllowed } from '@/lib/runtime-policy';
import { callEdgeVideoCreate, edgeVideoGatewayEnabled } from '@/lib/edge-video-provider';

export const runtime = 'nodejs';

async function downloadAndSave(supabase:any, remoteUrl:string, path:string) {
  const file = await fetch(remoteUrl);
  if (!file.ok) throw new Error(`Video download failed: ${file.status}`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = file.headers.get('content-type') || 'video/mp4';
  const { error } = await supabase.storage.from('generation-assets').upload(path, bytes, { contentType:mime, upsert:false });
  if (error) throw error;
  return { mime };
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if (!token) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
    const { projectId, scene, prompt, imageUrl, imageStoragePath, durationSeconds=5, locale='ar', quality='quality' } = await req.json(); const qualityTier=normalizeQuality(quality);
    if (!projectId || !scene || !prompt?.trim() || !imageUrl) return NextResponse.json({ error:'Missing project, scene, prompt or image' }, { status:400 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase environment');
    const supabase = createClient(url, key, { global:{ headers:{ Authorization:`Bearer ${token}` } }, auth:{ persistSession:false, autoRefreshToken:false } });
    const { data:{ user }, error:userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
    const { data:project, error:pErr } = await supabase.from('projects').select('id,organization_id').eq('id',projectId).single();
    if (pErr || !project) throw pErr ?? new Error('Project not found');

    const { data:generation, error:gErr } = await supabase.from('generations').insert({
      organization_id:project.organization_id, project_id:project.id, kind:'video', status:'processing',
      prompt:{ scene, prompt, imageStoragePath, durationSeconds, locale, quality:qualityTier }, provider_code:'pending', credits_charged:0, created_by:user.id,
    }).select('id').single();
    if (gErr || !generation) throw gErr ?? new Error('Could not create generation');
    const { data:job, error:jErr } = await supabase.from('media_jobs').insert({
      organization_id:project.organization_id, project_id:project.id, generation_id:generation.id, kind:'video_scene', scene_no:Number(scene),
      status:'processing', input:{ prompt, imageStoragePath, durationSeconds, locale, quality:qualityTier }, created_by:user.id, started_at:new Date().toISOString()
    }).select('id').single();
    if (jErr || !job) throw jErr ?? new Error('Could not create media job');

    if (edgeVideoGatewayEnabled()) {
      await quoteCredits(token,'video_scene');
      const edge = await callEdgeVideoCreate(supabase,{prompt,imageUrl,durationSeconds:Number(durationSeconds),aspectRatio:'9:16'});
      const now = new Date().toISOString();
      if (edge.status === 'failed') throw new Error('Secure video provider failed');
      if (edge.videoUrl) {
        const path = `${project.organization_id}/${project.id}/scene-${scene}/${generation.id}.mp4`;
        const { mime } = await downloadAndSave(supabase, edge.videoUrl, path);
        await supabase.from('generation_assets').insert({ generation_id:generation.id, asset_type:'scene_video', storage_path:path, mime_type:mime, metadata:{ scene, mode:'provider', gateway:'supabase-edge-video' } });
        const credit=await chargeCredits({token,action:'video_scene',idempotencyKey:`video:${generation.id}`,referenceType:'generation',referenceId:generation.id,metadata:{projectId,scene}});
        await supabase.from('generations').update({ status:'succeeded', provider_code:edge.provider, model_code:edge.model, response:{ storagePath:path, scene, mode:'provider', quality:qualityTier, gateway:'supabase-edge-video' }, credits_charged:credit.credits, provider_cost_usd:edge.estimatedCostUsd??null, completed_at:now }).eq('id',generation.id);
        await recordGenerationCost({generationId:generation.id,organizationId:project.organization_id,providerCode:edge.provider,modelCode:edge.model,providerCostUsd:edge.estimatedCostUsd??undefined,billableCredits:credit.credits,rawUsage:{quality:qualityTier,durationSeconds:Number(durationSeconds),latencyMs:edge.latencyMs,gateway:'supabase-edge-video'}});
        await supabase.from('media_jobs').update({ status:'succeeded', progress:100, provider_status:'succeeded', provider_code:edge.provider, model_code:edge.model, output:{ storagePath:path, scene, mode:'provider', gateway:'supabase-edge-video' }, finished_at:now }).eq('id',job.id);
        const { data:signed } = await supabase.storage.from('generation-assets').createSignedUrl(path,60*60);
        return NextResponse.json({ jobId:job.id, generationId:generation.id, scene, status:'succeeded', mode:'provider', videoUrl:signed?.signedUrl, storagePath:path, quality:qualityTier, provider:edge.provider, model:edge.model });
      }
      if (!edge.jobId) throw new Error('Secure video provider returned neither a video nor a job id');
      await supabase.from('generations').update({ provider_code:edge.provider, model_code:edge.model, external_job_id:String(edge.jobId), provider_cost_usd:edge.estimatedCostUsd??null, response:{ scene, mode:'provider', gateway:'supabase-edge-video', quality:qualityTier } }).eq('id',generation.id);
      await supabase.from('media_jobs').update({ provider_code:edge.provider, model_code:edge.model, external_job_id:String(edge.jobId), progress:0, provider_status:edge.rawStatus||'processing', next_poll_at:new Date(Date.now()+4000).toISOString(), output:{gateway:'supabase-edge-video'} }).eq('id',job.id);
      return NextResponse.json({ jobId:job.id, generationId:generation.id, scene, status:'processing', mode:'provider', quality:qualityTier, provider:edge.provider, model:edge.model });
    }

    const providerCandidates=await resolveProviderCandidates(supabase,project.organization_id,'video',qualityTier);
    if (!providerCandidates.length) {
      if(!developmentFallbackAllowed()) throw new Error('No video provider configured');
      const now = new Date().toISOString();
      await supabase.from('generations').update({ status:'succeeded', provider_code:'development', model_code:'motion-preview-v1', response:{ scene, mode:'development', imageStoragePath, durationSeconds }, completed_at:now }).eq('id',generation.id);
      await supabase.from('media_jobs').update({ status:'succeeded', provider_code:'development', model_code:'motion-preview-v1', output:{ scene, mode:'development', imageStoragePath, durationSeconds }, finished_at:now }).eq('id',job.id);
      return NextResponse.json({ jobId:job.id, generationId:generation.id, scene, status:'succeeded', mode:'development', posterUrl:imageUrl, durationSeconds });
    }

    await quoteCredits(token,'video_scene');
    const executed=await runProviderCandidates({supabase,organizationId:project.organization_id,generationId:generation.id,mediaJobId:job.id,kind:'video',quality:qualityTier,expectedUnits:Math.max(1,Number(durationSeconds)/5),run:async(config,signal)=>{
      const response=await fetch(config.endpoint,{method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.apiKey}`},body:JSON.stringify({model:config.model,prompt,image_url:imageUrl,duration:Number(durationSeconds),aspect_ratio:'9:16'})});
      if(!response.ok)throw new Error(`Video provider failed: ${response.status}`); const json:any=await response.json(); return {json,config};
    }});
    if(!executed)throw new Error('No video provider configured');
    const {json,config}=executed.result;
    const remoteUrl = json?.video_url ?? json?.url ?? json?.data?.url ?? json?.output?.url;
    const externalJobId = json?.job_id ?? json?.id ?? json?.task_id ?? json?.data?.id;
    if (remoteUrl) {
      const path = `${project.organization_id}/${project.id}/scene-${scene}/${generation.id}.mp4`;
      const { mime } = await downloadAndSave(supabase, remoteUrl, path);
      await supabase.from('generation_assets').insert({ generation_id:generation.id, asset_type:'scene_video', storage_path:path, mime_type:mime, metadata:{ scene, mode:'provider' } });
      const credit=await chargeCredits({token,action:'video_scene',idempotencyKey:`video:${generation.id}`,referenceType:'generation',referenceId:generation.id,metadata:{projectId,scene}});
      const now = new Date().toISOString();
      const estimatedCostUsd=estimateUnitCostUsd(config,Math.max(1,Number(durationSeconds)/5));
      await supabase.from('generations').update({ status:'succeeded', provider_code:config.provider, model_code:config.model, response:{ storagePath:path, scene, mode:'provider', quality:qualityTier }, credits_charged:credit.credits, provider_cost_usd:estimatedCostUsd??null, completed_at:now }).eq('id',generation.id);
      await recordGenerationCost({generationId:generation.id,organizationId:project.organization_id,providerCode:config.provider,modelCode:config.model,providerCostUsd:estimatedCostUsd,billableCredits:credit.credits,rawUsage:{quality:qualityTier,durationSeconds:Number(durationSeconds)}});
      await supabase.from('media_jobs').update({ status:'succeeded', provider_code:config.provider, model_code:config.model, output:{ storagePath:path, scene, mode:'provider' }, finished_at:now }).eq('id',job.id);
      const { data:signed } = await supabase.storage.from('generation-assets').createSignedUrl(path,60*60);
      return NextResponse.json({ jobId:job.id, generationId:generation.id, scene, status:'succeeded', mode:'provider', videoUrl:signed?.signedUrl, storagePath:path, quality:qualityTier, provider:config.provider, model:config.model });
    }
    if (!externalJobId) throw new Error('Video provider returned neither a video nor a job id');
    await supabase.from('generations').update({ provider_code:config.provider, model_code:config.model, external_job_id:String(externalJobId), response:{ scene, mode:'provider' } }).eq('id',generation.id);
    await supabase.from('media_jobs').update({ provider_code:config.provider, model_code:config.model, external_job_id:String(externalJobId) }).eq('id',job.id);
    return NextResponse.json({ jobId:job.id, generationId:generation.id, scene, status:'processing', mode:'provider', quality:qualityTier, provider:config.provider, model:config.model });
  } catch (error) {
    if(isCreditError(error)) return NextResponse.json({error:'insufficient_credits'},{status:402});
    return NextResponse.json({ error:error instanceof Error ? error.message : 'Unknown error' }, { status:500 });
  }
}
