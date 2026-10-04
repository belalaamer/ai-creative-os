import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chargeCredits, isCreditError } from '@/lib/credits-server';
import { callEdgeAssemblyStatus } from '@/lib/edge-video-provider';
import { recordGenerationCost } from '@/lib/generation-costs';

export const runtime = 'nodejs';

export async function GET(req:NextRequest, context:{params:Promise<{id:string}>}) {
  try {
    const {id}=await context.params;
    const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if(!token) return NextResponse.json({error:'Unauthorized'},{status:401});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if(!url||!key) throw new Error('Missing Supabase environment');
    const supabase=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:job,error:jErr}=await supabase.from('media_jobs').select('*').eq('id',id).single();
    if(jErr||!job) return NextResponse.json({error:'Job not found'},{status:404});
    if(job.kind!=='assembly') return NextResponse.json({error:'Not an assembly job'},{status:400});

    if(job.status==='succeeded'){
      const path=job.output?.storagePath;
      if(path){const {data:signed}=await supabase.storage.from('generation-assets').createSignedUrl(path,60*60);return NextResponse.json({jobId:id,status:'succeeded',mode:'provider',videoUrl:signed?.signedUrl,storagePath:path,progress:100});}
      return NextResponse.json({jobId:id,status:'succeeded',...job.output,progress:100});
    }
    if(job.status==='failed'||job.status==='cancelled') return NextResponse.json({jobId:id,status:job.status,error:job.error});
    if(job.output?.gateway!=='supabase-edge-assembly'||!job.external_job_id) return NextResponse.json({jobId:id,status:'processing',progress:job.progress??0});

    const edge=await callEdgeAssemblyStatus(supabase,String(job.external_job_id));
    const pollCount=Number(job.poll_count??0)+1;
    const now=new Date().toISOString();
    if(edge.status==='failed'){
      await supabase.from('media_jobs').update({status:'failed',progress:edge.progress??0,provider_status:'failed',poll_count:pollCount,last_polled_at:now,error:{message:'Secure assembly provider failed'},finished_at:now}).eq('id',id);
      if(job.generation_id) await supabase.from('generations').update({status:'failed',completed_at:now,response:{error:'Secure assembly provider failed',gateway:'supabase-edge-assembly'}}).eq('id',job.generation_id);
      return NextResponse.json({jobId:id,status:'failed',error:'Secure assembly provider failed'});
    }
    if(!edge.videoUrl){
      await supabase.from('media_jobs').update({progress:edge.progress??job.progress??0,provider_status:'processing',poll_count:pollCount,last_polled_at:now,next_poll_at:new Date(Date.now()+4000).toISOString()}).eq('id',id);
      return NextResponse.json({jobId:id,status:'processing',progress:edge.progress??job.progress??0});
    }

    const file=await fetch(edge.videoUrl);if(!file.ok)throw new Error(`Assembly download failed: ${file.status}`);
    const bytes=new Uint8Array(await file.arrayBuffer());const mime=file.headers.get('content-type')||'video/mp4';
    const path=`${job.organization_id}/${job.project_id}/exports/${job.generation_id}.mp4`;
    const {error:uErr}=await supabase.storage.from('generation-assets').upload(path,bytes,{contentType:mime,upsert:false});if(uErr)throw uErr;
    if(job.generation_id) await supabase.from('generation_assets').insert({generation_id:job.generation_id,asset_type:'final_video',storage_path:path,mime_type:mime,metadata:{mode:'provider',gateway:'supabase-edge-assembly'}});
    let charged=0;
    if(job.generation_id){const credit=await chargeCredits({token,action:'final_assembly',idempotencyKey:`assembly:${job.generation_id}`,referenceType:'generation',referenceId:job.generation_id,metadata:{projectId:job.project_id}});charged=credit.credits;}
    await supabase.from('media_jobs').update({status:'succeeded',progress:100,provider_status:'succeeded',poll_count:pollCount,last_polled_at:now,next_poll_at:null,output:{storagePath:path,mode:'provider',gateway:'supabase-edge-assembly'},finished_at:now}).eq('id',id);
    if(job.generation_id){
      const {data:g}=await supabase.from('generations').select('provider_cost_usd').eq('id',job.generation_id).single();
      const estimatedCostUsd=g?.provider_cost_usd==null?undefined:Number(g.provider_cost_usd);
      await supabase.from('generations').update({status:'succeeded',response:{storagePath:path,mode:'provider',gateway:'supabase-edge-assembly'},credits_charged:charged,completed_at:now}).eq('id',job.generation_id);
      await recordGenerationCost({generationId:job.generation_id,organizationId:job.organization_id,providerCode:job.provider_code||edge.provider,modelCode:job.model_code||edge.model,providerCostUsd:estimatedCostUsd,billableCredits:charged,rawUsage:{gateway:'supabase-edge-assembly',pollCount}});
    }
    const {data:signed}=await supabase.storage.from('generation-assets').createSignedUrl(path,60*60);
    return NextResponse.json({jobId:id,status:'succeeded',mode:'provider',videoUrl:signed?.signedUrl,storagePath:path,progress:100});
  }catch(error){
    if(isCreditError(error)) return NextResponse.json({error:'insufficient_credits'},{status:402});
    return NextResponse.json({error:error instanceof Error?error.message:'Unknown error'},{status:500});
  }
}
