import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chargeCredits, isCreditError } from '@/lib/credits-server';
import { estimateUnitCostUsd, findProviderCandidate, normalizeQuality } from '@/lib/provider-router';
import { recordGenerationCost } from '@/lib/generation-costs';
import { callEdgeVideoStatus } from '@/lib/edge-video-provider';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, context:{params:Promise<{id:string}>}) {
  try {
    const { id } = await context.params;
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if (!token) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase environment');
    const supabase = createClient(url, key, { global:{ headers:{ Authorization:`Bearer ${token}` } }, auth:{ persistSession:false, autoRefreshToken:false } });
    const { data:job, error:jErr } = await supabase.from('media_jobs').select('*').eq('id',id).single();
    if (jErr || !job) return NextResponse.json({ error:'Job not found' }, { status:404 });
    if (job.status === 'succeeded') {
      const path = job.output?.storagePath;
      if (path) {
        const { data:signed } = await supabase.storage.from('generation-assets').createSignedUrl(path,60*60);
        return NextResponse.json({ jobId:id, status:'succeeded', mode:job.output?.mode || 'provider', videoUrl:signed?.signedUrl, storagePath:path, scene:job.scene_no });
      }
      return NextResponse.json({ jobId:id, status:'succeeded', mode:job.output?.mode || 'development', scene:job.scene_no, ...job.output });
    }
    if (job.status === 'failed' || job.status === 'cancelled') return NextResponse.json({ jobId:id, status:job.status, error:job.error });

    if (job.output?.gateway === 'supabase-edge-video' && job.external_job_id) {
      const edge=await callEdgeVideoStatus(supabase,String(job.external_job_id));
      const pollCount=Number(job.poll_count??0)+1;
      const now=new Date().toISOString();
      if(edge.status==='failed'){
        await supabase.from('media_jobs').update({status:'failed',progress:edge.progress??0,provider_status:edge.rawStatus||'failed',poll_count:pollCount,last_polled_at:now,error:{message:'Secure video provider failed'},finished_at:now}).eq('id',id);
        if(job.generation_id) await supabase.from('generations').update({status:'failed',completed_at:now,response:{error:'Secure video provider failed',gateway:'supabase-edge-video'}}).eq('id',job.generation_id);
        return NextResponse.json({jobId:id,status:'failed',error:'Secure video provider failed'});
      }
      if(!edge.videoUrl){
        await supabase.from('media_jobs').update({progress:edge.progress??job.progress??0,provider_status:edge.rawStatus||'processing',poll_count:pollCount,last_polled_at:now,next_poll_at:new Date(Date.now()+4000).toISOString()}).eq('id',id);
        return NextResponse.json({jobId:id,status:'processing',progress:edge.progress??job.progress??0,providerStatus:edge.rawStatus||'processing'});
      }
      const file=await fetch(edge.videoUrl);
      if(!file.ok) throw new Error(`Video download failed: ${file.status}`);
      const bytes=new Uint8Array(await file.arrayBuffer());
      const mime=file.headers.get('content-type')||'video/mp4';
      const path=`${job.organization_id}/${job.project_id}/scene-${job.scene_no}/${job.generation_id}.mp4`;
      const {error:uploadError}=await supabase.storage.from('generation-assets').upload(path,bytes,{contentType:mime,upsert:false});
      if(uploadError) throw uploadError;
      if(job.generation_id) await supabase.from('generation_assets').insert({generation_id:job.generation_id,asset_type:'scene_video',storage_path:path,mime_type:mime,metadata:{scene:job.scene_no,mode:'provider',gateway:'supabase-edge-video'}});
      let charged=0;
      if(job.generation_id){const credit=await chargeCredits({token,action:'video_scene',idempotencyKey:`video:${job.generation_id}`,referenceType:'generation',referenceId:job.generation_id,metadata:{projectId:job.project_id,scene:job.scene_no}});charged=credit.credits;}
      await supabase.from('media_jobs').update({status:'succeeded',progress:100,provider_status:'succeeded',poll_count:pollCount,last_polled_at:now,next_poll_at:null,output:{storagePath:path,scene:job.scene_no,mode:'provider',gateway:'supabase-edge-video'},finished_at:now}).eq('id',id);
      if(job.generation_id){
        const {data:g}=await supabase.from('generations').select('provider_cost_usd').eq('id',job.generation_id).single();
        const estimatedCostUsd=g?.provider_cost_usd==null?undefined:Number(g.provider_cost_usd);
        await supabase.from('generations').update({status:'succeeded',response:{storagePath:path,scene:job.scene_no,mode:'provider',gateway:'supabase-edge-video'},credits_charged:charged,completed_at:now}).eq('id',job.generation_id);
        await recordGenerationCost({generationId:job.generation_id,organizationId:job.organization_id,providerCode:job.provider_code||edge.provider,modelCode:job.model_code||edge.model,providerCostUsd:estimatedCostUsd,billableCredits:charged,rawUsage:{gateway:'supabase-edge-video',pollCount}});
      }
      const {data:signed}=await supabase.storage.from('generation-assets').createSignedUrl(path,60*60);
      return NextResponse.json({jobId:id,status:'succeeded',mode:'provider',videoUrl:signed?.signedUrl,storagePath:path,scene:job.scene_no,progress:100});
    }

    const qualityTier=normalizeQuality(job.input?.quality);
    const config=findProviderCandidate('video',qualityTier,job.provider_code,job.model_code);
    const endpointTemplate=config?.statusEndpoint;
    const apiKey=config?.apiKey;
    if (!config || !endpointTemplate || !apiKey || !job.external_job_id) return NextResponse.json({ jobId:id, status:'processing' });
    const endpoint = endpointTemplate.includes('{jobId}') ? endpointTemplate.replace('{jobId}', encodeURIComponent(job.external_job_id)) : `${endpointTemplate.replace(/\/$/,'')}/${encodeURIComponent(job.external_job_id)}`;
    const response = await fetch(endpoint,{ headers:{ Authorization:`Bearer ${apiKey}` } });
    if (!response.ok) throw new Error(`Video status provider failed: ${response.status}`);
    const json:any = await response.json();
    const providerStatus = String(json?.status ?? json?.data?.status ?? json?.state ?? '').toLowerCase();
    const failed = ['failed','error','cancelled','canceled'].includes(providerStatus);
    if (failed) {
      const now = new Date().toISOString();
      await supabase.from('media_jobs').update({ status:'failed', error:json, finished_at:now }).eq('id',id);
      if (job.generation_id) await supabase.from('generations').update({ status:'failed', response:json, completed_at:now }).eq('id',job.generation_id);
      return NextResponse.json({ jobId:id, status:'failed', error:json });
    }
    const remoteUrl = json?.video_url ?? json?.url ?? json?.data?.url ?? json?.output?.url;
    if (!remoteUrl) return NextResponse.json({ jobId:id, status:'processing', providerStatus });
    const file = await fetch(remoteUrl);
    if (!file.ok) throw new Error(`Video download failed: ${file.status}`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = file.headers.get('content-type') || 'video/mp4';
    const path = `${job.organization_id}/${job.project_id}/scene-${job.scene_no}/${job.generation_id}.mp4`;
    const { error:uploadError } = await supabase.storage.from('generation-assets').upload(path,bytes,{contentType:mime,upsert:false});
    if (uploadError) throw uploadError;
    if (job.generation_id) await supabase.from('generation_assets').insert({ generation_id:job.generation_id, asset_type:'scene_video', storage_path:path, mime_type:mime, metadata:{scene:job.scene_no,mode:'provider'} });
    let charged=0;
    if(job.generation_id){
      const credit=await chargeCredits({token,action:'video_scene',idempotencyKey:`video:${job.generation_id}`,referenceType:'generation',referenceId:job.generation_id,metadata:{projectId:job.project_id,scene:job.scene_no}});
      charged=credit.credits;
    }
    const now = new Date().toISOString();
    await supabase.from('media_jobs').update({ status:'succeeded', output:{storagePath:path,scene:job.scene_no,mode:'provider'}, finished_at:now }).eq('id',id);
    if (job.generation_id) { const durationSeconds=Number(job.input?.durationSeconds??5); const estimatedCostUsd=estimateUnitCostUsd(config,Math.max(1,durationSeconds/5)); await supabase.from('generations').update({ status:'succeeded', response:{storagePath:path,scene:job.scene_no,mode:'provider',quality:qualityTier}, credits_charged:charged, provider_cost_usd:estimatedCostUsd??null, completed_at:now }).eq('id',job.generation_id); await recordGenerationCost({generationId:job.generation_id,organizationId:job.organization_id,providerCode:job.provider_code??config.provider,modelCode:job.model_code??config.model,providerCostUsd:estimatedCostUsd,billableCredits:charged,rawUsage:{quality:qualityTier,durationSeconds}}); }
    const { data:signed } = await supabase.storage.from('generation-assets').createSignedUrl(path,60*60);
    return NextResponse.json({ jobId:id, status:'succeeded', mode:'provider', videoUrl:signed?.signedUrl, storagePath:path, scene:job.scene_no });
  } catch (error) {
    if(isCreditError(error)) return NextResponse.json({error:'insufficient_credits'},{status:402});
    return NextResponse.json({ error:error instanceof Error ? error.message : 'Unknown error' }, { status:500 });
  }
}
