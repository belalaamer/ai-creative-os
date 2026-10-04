import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chargeCredits, isCreditError, quoteCredits } from '@/lib/credits-server';
import { developmentFallbackAllowed } from '@/lib/runtime-policy';
import { callEdgeAssemblyCreate, edgeAssemblyGatewayEnabled } from '@/lib/edge-video-provider';
import { recordGenerationCost } from '@/lib/generation-costs';

export const runtime = 'nodejs';

export async function POST(req:NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if (!token) return NextResponse.json({error:'Unauthorized'},{status:401});
    const { projectId, scenes, locale='ar' } = await req.json();
    if (!projectId || !Array.isArray(scenes) || !scenes.length) return NextResponse.json({error:'Missing project or scenes'},{status:400});
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase environment');
    const supabase = createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user}} = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({error:'Unauthorized'},{status:401});
    const {data:project,error:pErr}=await supabase.from('projects').select('id,organization_id').eq('id',projectId).single();
    if (pErr||!project) throw pErr ?? new Error('Project not found');
    const {data:generation,error:gErr}=await supabase.from('generations').insert({organization_id:project.organization_id,project_id:project.id,kind:'video',status:'processing',prompt:{scenes,locale},provider_code:'pending',credits_charged:0,created_by:user.id}).select('id').single();
    if(gErr||!generation)throw gErr??new Error('Could not create generation');
    const {data:job,error:jErr}=await supabase.from('media_jobs').insert({organization_id:project.organization_id,project_id:project.id,generation_id:generation.id,kind:'assembly',status:'processing',input:{scenes,locale},created_by:user.id,started_at:new Date().toISOString()}).select('id').single();
    if(jErr||!job)throw jErr??new Error('Could not create media job');

    if(edgeAssemblyGatewayEnabled()) {
      await quoteCredits(token,'final_assembly');
      const edge=await callEdgeAssemblyCreate(supabase,{scenes,locale,aspectRatio:'9:16',subtitles:true});
      const now=new Date().toISOString();
      if(edge.status==='failed') throw new Error('Secure assembly provider failed');
      if(edge.videoUrl){
        const file=await fetch(edge.videoUrl);if(!file.ok)throw new Error(`Assembly download failed: ${file.status}`);
        const bytes=new Uint8Array(await file.arrayBuffer());const mime=file.headers.get('content-type')||'video/mp4';
        const path=`${project.organization_id}/${project.id}/exports/${generation.id}.mp4`;
        const {error:uErr}=await supabase.storage.from('generation-assets').upload(path,bytes,{contentType:mime,upsert:false});if(uErr)throw uErr;
        await supabase.from('generation_assets').insert({generation_id:generation.id,asset_type:'final_video',storage_path:path,mime_type:mime,metadata:{mode:'provider',gateway:'supabase-edge-assembly'}});
        const credit=await chargeCredits({token,action:'final_assembly',idempotencyKey:`assembly:${generation.id}`,referenceType:'generation',referenceId:generation.id,metadata:{projectId}});
        await supabase.from('generations').update({status:'succeeded',provider_code:edge.provider,model_code:edge.model,provider_cost_usd:edge.estimatedCostUsd??null,response:{storagePath:path,mode:'provider',gateway:'supabase-edge-assembly'},credits_charged:credit.credits,completed_at:now}).eq('id',generation.id);
        await recordGenerationCost({generationId:generation.id,organizationId:project.organization_id,providerCode:edge.provider,modelCode:edge.model,providerCostUsd:edge.estimatedCostUsd??undefined,billableCredits:credit.credits,rawUsage:{gateway:'supabase-edge-assembly',latencyMs:edge.latencyMs,sceneCount:scenes.length}});
        await supabase.from('media_jobs').update({status:'succeeded',progress:100,provider_status:'succeeded',provider_code:edge.provider,model_code:edge.model,output:{storagePath:path,mode:'provider',gateway:'supabase-edge-assembly'},finished_at:now}).eq('id',job.id);
        const {data:signed}=await supabase.storage.from('generation-assets').createSignedUrl(path,60*60);
        return NextResponse.json({jobId:job.id,generationId:generation.id,status:'succeeded',mode:'provider',videoUrl:signed?.signedUrl,storagePath:path,progress:100});
      }
      if(!edge.jobId) throw new Error('Secure assembly provider returned neither a video nor a job id');
      await supabase.from('generations').update({provider_code:edge.provider,model_code:edge.model,external_job_id:String(edge.jobId),provider_cost_usd:edge.estimatedCostUsd??null,response:{mode:'provider',gateway:'supabase-edge-assembly'}}).eq('id',generation.id);
      await supabase.from('media_jobs').update({provider_code:edge.provider,model_code:edge.model,external_job_id:String(edge.jobId),progress:0,provider_status:'processing',next_poll_at:new Date(Date.now()+4000).toISOString(),output:{gateway:'supabase-edge-assembly'}}).eq('id',job.id);
      return NextResponse.json({jobId:job.id,generationId:generation.id,status:'processing',mode:'provider',provider:edge.provider,model:edge.model,progress:0});
    }

    const endpoint=process.env.MEDIA_ASSEMBLY_ENDPOINT;
    const apiKey=process.env.MEDIA_ASSEMBLY_API_KEY;
    if(endpoint&&apiKey){
      await quoteCredits(token,'final_assembly');
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body:JSON.stringify({scenes,format:'mp4',aspect_ratio:'9:16'})});
      if(!response.ok)throw new Error(`Assembly provider failed: ${response.status}`);
      const json:any=await response.json();
      const remoteUrl=json?.video_url??json?.url??json?.data?.url;
      if(remoteUrl){
        const file=await fetch(remoteUrl);if(!file.ok)throw new Error(`Assembly download failed: ${file.status}`);
        const bytes=new Uint8Array(await file.arrayBuffer());const mime=file.headers.get('content-type')||'video/mp4';
        const path=`${project.organization_id}/${project.id}/exports/${generation.id}.mp4`;
        const {error:uErr}=await supabase.storage.from('generation-assets').upload(path,bytes,{contentType:mime,upsert:false});if(uErr)throw uErr;
        await supabase.from('generation_assets').insert({generation_id:generation.id,asset_type:'final_video',storage_path:path,mime_type:mime,metadata:{mode:'provider'}});
        const credit=await chargeCredits({token,action:'final_assembly',idempotencyKey:`assembly:${generation.id}`,referenceType:'generation',referenceId:generation.id,metadata:{projectId}});
        const now=new Date().toISOString();
        await supabase.from('generations').update({status:'succeeded',provider_code:'external',model_code:'assembly',response:{storagePath:path,mode:'provider'},credits_charged:credit.credits,completed_at:now}).eq('id',generation.id);
        await supabase.from('media_jobs').update({status:'succeeded',provider_code:'external',model_code:'assembly',output:{storagePath:path,mode:'provider'},finished_at:now}).eq('id',job.id);
        const {data:signed}=await supabase.storage.from('generation-assets').createSignedUrl(path,60*60);
        return NextResponse.json({jobId:job.id,generationId:generation.id,status:'succeeded',mode:'provider',videoUrl:signed?.signedUrl,storagePath:path});
      }
      if(!developmentFallbackAllowed()) throw new Error('Assembly provider returned no video URL');
    } else if(!developmentFallbackAllowed()) {
      throw new Error('No assembly provider configured');
    }

    const manifest={version:1,projectId,locale,aspectRatio:'9:16',createdAt:new Date().toISOString(),scenes};
    const bytes=new TextEncoder().encode(JSON.stringify(manifest,null,2));
    const path=`${project.organization_id}/${project.id}/exports/${generation.id}.json`;
    const {error:uErr}=await supabase.storage.from('generation-assets').upload(path,bytes,{contentType:'application/json',upsert:false});if(uErr)throw uErr;
    await supabase.from('generation_assets').insert({generation_id:generation.id,asset_type:'assembly_manifest',storage_path:path,mime_type:'application/json',metadata:{mode:'development'}});
    const now=new Date().toISOString();
    await supabase.from('generations').update({status:'succeeded',provider_code:'development',model_code:'timeline-manifest-v1',response:{storagePath:path,mode:'development'},completed_at:now}).eq('id',generation.id);
    await supabase.from('media_jobs').update({status:'succeeded',provider_code:'development',model_code:'timeline-manifest-v1',output:{storagePath:path,mode:'development'},finished_at:now}).eq('id',job.id);
    const {data:signed}=await supabase.storage.from('generation-assets').createSignedUrl(path,60*60);
    return NextResponse.json({jobId:job.id,generationId:generation.id,status:'succeeded',mode:'development',manifestUrl:signed?.signedUrl,storagePath:path});
  }catch(error){if(isCreditError(error))return NextResponse.json({error:'insufficient_credits'},{status:402});return NextResponse.json({error:error instanceof Error?error.message:'Unknown error'},{status:500});}
}
