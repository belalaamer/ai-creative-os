import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chargeCredits, isCreditError, quoteCredits } from '@/lib/credits-server';
import { estimateUnitCostUsd, resolveProviderCandidates, normalizeQuality } from '@/lib/provider-router';
import { runProviderCandidates } from '@/lib/provider-execution';
import { recordGenerationCost } from '@/lib/generation-costs';
import { callVoiceProvider } from '@/lib/provider-adapters';
import { developmentFallbackAllowed } from '@/lib/runtime-policy';
import { callEdgeSpeechProvider, edgeSpeechProviderEnabled } from '@/lib/edge-media-provider';

export const runtime = 'nodejs';

function makeSilentWav(seconds: number, sampleRate = 16000) {
  const duration = Math.max(1, Math.min(30, seconds || 3));
  const samples = Math.floor(sampleRate * duration);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write('WAVE', 8);
  buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(dataSize, 40);
  return new Uint8Array(buffer);
}

type VoiceOutput = { bytes: Uint8Array; mime: string; provider: string; model: string; mode: 'provider'|'development'; estimatedCostUsd?:number; rawUsage?:Record<string,unknown> };

async function generateProviderVoice(text: string, locale: 'ar'|'en', quality: unknown, supabase:any, organizationId:string, generationId:string, mediaJobId:string): Promise<VoiceOutput | null> {
  const executed=await runProviderCandidates({supabase,organizationId,generationId,mediaJobId,kind:'audio',quality,expectedUnits:Math.max(1,text.length/1000),run:async(config,signal)=>{
    const started=Date.now(); const result=await callVoiceProvider(config,{text,locale,signal,format:'mp3'});
    const rawUsage={...(result.usage??{}),latency_ms:Date.now()-started,quality:config.quality,characters:text.length}; const estimatedCostUsd=estimateUnitCostUsd(config,Math.max(1,text.length/1000));
    return {bytes:result.bytes,mime:result.mime,provider:config.provider,model:config.model,mode:'provider',estimatedCostUsd,rawUsage} as VoiceOutput;
  }}); return executed?.result??null;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if (!token) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
    const { projectId, scene, text, locale='ar', durationSeconds=3, quality='quality' } = await req.json(); const qualityTier=normalizeQuality(quality);
    if (!projectId || !scene || !text?.trim()) return NextResponse.json({ error:'Missing project, scene or text' }, { status:400 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase environment');
    const supabase = createClient(url, key, { global:{ headers:{ Authorization:`Bearer ${token}` } }, auth:{ persistSession:false, autoRefreshToken:false } });
    const { data:{ user }, error:userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
    const { data:project, error:pErr } = await supabase.from('projects').select('id,organization_id').eq('id',projectId).single();
    if (pErr || !project) throw pErr ?? new Error('Project not found');
    const { data:generation, error:gErr } = await supabase.from('generations').insert({ organization_id:project.organization_id, project_id:project.id, kind:'audio', status:'processing', prompt:{ scene, text, locale, quality:qualityTier }, provider_code:'pending', credits_charged:0, created_by:user.id }).select('id').single();
    if (gErr || !generation) throw gErr ?? new Error('Could not create generation');
    const { data:job, error:jErr } = await supabase.from('media_jobs').insert({ organization_id:project.organization_id, project_id:project.id, generation_id:generation.id, kind:'voiceover', scene_no:Number(scene), status:'processing', input:{ text, locale, durationSeconds, quality:qualityTier }, created_by:user.id, started_at:new Date().toISOString() }).select('id').single();
    if (jErr || !job) throw jErr ?? new Error('Could not create media job');
    const edgeConfigured=edgeSpeechProviderEnabled();
    const providerConfigured=edgeConfigured || (await resolveProviderCandidates(supabase,project.organization_id,'audio',qualityTier)).length>0;
    if(providerConfigured) await quoteCredits(token,'voice_scene');
    if(!providerConfigured && !developmentFallbackAllowed()) throw new Error('No audio provider configured');
    let output: VoiceOutput;
    try {
      if(edgeConfigured){
        const edge=await callEdgeSpeechProvider(supabase,{input:text,voice:process.env.OPENAI_SPEECH_VOICE||undefined,responseFormat:'mp3',instructions:locale === 'ar' ? 'Speak naturally in clear Arabic suitable for an advertisement.' : 'Speak naturally in clear English suitable for an advertisement.'});
        output={bytes:edge.bytes,mime:edge.mime,provider:edge.provider,model:edge.model,mode:'provider',estimatedCostUsd:edge.estimatedCostUsd??undefined,rawUsage:{latency_ms:edge.latencyMs,quality:qualityTier,voice:edge.voice??null,gateway:'supabase-edge'}};
      } else {
        output = (await generateProviderVoice(text, locale === 'en' ? 'en' : 'ar', qualityTier, supabase, project.organization_id, generation.id, job.id)) ?? { bytes:makeSilentWav(Number(durationSeconds)), mime:'audio/wav', provider:'development', model:'silent-wav-v1', mode:'development' };
      }
    } catch (providerError) {
      if(!developmentFallbackAllowed()) throw providerError;
      output = { bytes:makeSilentWav(Number(durationSeconds)), mime:'audio/wav', provider:'development', model:'silent-wav-v1', mode:'development' };
    }
    const ext = output.mime.includes('wav') ? 'wav' : output.mime.includes('ogg') ? 'ogg' : 'mp3';
    const path = `${project.organization_id}/${project.id}/scene-${scene}/${generation.id}.${ext}`;
    const { error:uploadError } = await supabase.storage.from('generation-assets').upload(path, output.bytes, { contentType:output.mime, upsert:false });
    if (uploadError) throw uploadError;
    const { error:aErr } = await supabase.from('generation_assets').insert({ generation_id:generation.id, asset_type:'scene_voiceover', storage_path:path, mime_type:output.mime, metadata:{ scene, mode:output.mode } });
    if (aErr) throw aErr;
    const now = new Date().toISOString();
    let charged=0;
    if(output.mode==='provider'){
      const credit=await chargeCredits({token,action:'voice_scene',idempotencyKey:`voice:${generation.id}`,referenceType:'generation',referenceId:generation.id,metadata:{projectId,scene}});
      charged=credit.credits;
    }
    await supabase.from('generations').update({ status:'succeeded', provider_code:output.provider, model_code:output.model, response:{ storagePath:path, scene, mode:output.mode, quality:qualityTier }, credits_charged:charged, provider_cost_usd:output.estimatedCostUsd??null, completed_at:now }).eq('id',generation.id);
    if(output.mode==='provider') await recordGenerationCost({generationId:generation.id,organizationId:project.organization_id,providerCode:output.provider,modelCode:output.model,providerCostUsd:output.estimatedCostUsd,billableCredits:charged,rawUsage:output.rawUsage});
    await supabase.from('media_jobs').update({ status:'succeeded', provider_code:output.provider, model_code:output.model, output:{ storagePath:path, mode:output.mode }, finished_at:now }).eq('id',job.id);
    const { data:signed, error:signedErr } = await supabase.storage.from('generation-assets').createSignedUrl(path, 60*60);
    if (signedErr) throw signedErr;
    return NextResponse.json({ jobId:job.id, generationId:generation.id, scene, audioUrl:signed.signedUrl, storagePath:path, mode:output.mode, quality:qualityTier, provider:output.provider, model:output.model });
  } catch (error) {
    if(isCreditError(error)) return NextResponse.json({error:'insufficient_credits'},{status:402});
    return NextResponse.json({ error:error instanceof Error ? error.message : 'Unknown error' }, { status:500 });
  }
}
