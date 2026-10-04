import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chargeCredits, isCreditError, quoteCredits } from '@/lib/credits-server';
import { estimateUnitCostUsd, resolveProviderCandidates, normalizeQuality } from '@/lib/provider-router';
import { runProviderCandidates } from '@/lib/provider-execution';
import { recordGenerationCost } from '@/lib/generation-costs';
import { callImageProvider } from '@/lib/provider-adapters';
import { developmentFallbackAllowed } from '@/lib/runtime-policy';
import { callEdgeImageProvider, edgeImageProviderEnabled } from '@/lib/edge-media-provider';

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','\"':'&quot;' }[c] ?? c));
}

function wrapText(input: string, width = 42, maxLines = 9) {
  const words = input.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else line = next;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function developmentSvg(prompt: string, scene: number, locale: 'ar'|'en') {
  const lines = wrapText(prompt);
  const tspans = lines.map((x,i) => `<tspan x="80" dy="${i === 0 ? 0 : 48}">${escapeXml(x)}</tspan>`).join('');
  const title = locale === 'ar' ? `مشهد ${scene} — معاينة تطوير` : `Scene ${scene} — Development preview`;
  const note = locale === 'ar' ? 'اربط مزود صور حقيقي لاستبدال هذه المعاينة.' : 'Connect a real image provider to replace this preview.';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#18181b"/><stop offset="1" stop-color="#4c1d95"/></linearGradient></defs>
    <rect width="1024" height="1536" fill="url(#g)"/>
    <circle cx="830" cy="230" r="240" fill="#8b5cf6" opacity=".18"/>
    <circle cx="180" cy="1320" r="310" fill="#a78bfa" opacity=".10"/>
    <text x="80" y="130" fill="#c4b5fd" font-family="Arial, sans-serif" font-size="34" font-weight="700">${escapeXml(title)}</text>
    <text x="80" y="330" fill="#ffffff" font-family="Arial, sans-serif" font-size="42" font-weight="700">${tspans}</text>
    <text x="80" y="1430" fill="#d4d4d8" font-family="Arial, sans-serif" font-size="26">${escapeXml(note)}</text>
  </svg>`;
}

type ProviderImage = { bytes: Uint8Array; mime: string; provider: string; model: string; mode: 'provider'|'development'; estimatedCostUsd?: number; rawUsage?: Record<string,unknown> };

async function generateProviderImage(prompt: string, quality: unknown, supabase:any, organizationId:string, generationId:string): Promise<ProviderImage | null> {
  const executed=await runProviderCandidates({supabase,organizationId,generationId,kind:'image',quality,run:async(config,signal)=>{
    const started=Date.now();
    const result=await callImageProvider(config,{prompt,signal,size:'1024x1536',quality:process.env.IMAGE_AI_QUALITY||'medium'});
    const rawUsage={...(result.usage??{}),latency_ms:Date.now()-started,quality:config.quality}; const estimatedCostUsd=estimateUnitCostUsd(config,1);
    return {bytes:result.bytes,mime:result.mime,provider:config.provider,model:config.model,mode:'provider',estimatedCostUsd,rawUsage} as ProviderImage;
  }}); return executed?.result??null;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if (!token) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
    const { projectId, scene, prompt, locale='ar', quality='quality' } = await req.json(); const qualityTier=normalizeQuality(quality);
    if (!projectId || !scene || !prompt?.trim()) return NextResponse.json({ error:'Missing project, scene or prompt' }, { status:400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('Missing Supabase environment');
    const supabase = createClient(url, key, { global:{ headers:{ Authorization:`Bearer ${token}` } }, auth:{ persistSession:false, autoRefreshToken:false } });
    const { data:{ user }, error:userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error:'Unauthorized' }, { status:401 });

    const { data:project, error:pErr } = await supabase.from('projects').select('id,organization_id').eq('id',projectId).single();
    if (pErr || !project) throw pErr ?? new Error('Project not found');

    const { data:generation, error:gErr } = await supabase.from('generations').insert({
      organization_id:project.organization_id,
      project_id:project.id,
      kind:'image',
      status:'processing',
      prompt:{ scene, prompt, locale, quality:qualityTier },
      provider_code:'pending',
      credits_charged:0,
      created_by:user.id,
    }).select('id').single();
    if (gErr || !generation) throw gErr ?? new Error('Could not create generation');

    const edgeConfigured=edgeImageProviderEnabled();
    const providerConfigured=edgeConfigured || (await resolveProviderCandidates(supabase,project.organization_id,'image',qualityTier)).length>0;
    if(providerConfigured) await quoteCredits(token,'image_scene');
    if(!providerConfigured && !developmentFallbackAllowed()) throw new Error('No image provider configured');

    let output: ProviderImage;
    try {
      if(edgeConfigured){
        const edge=await callEdgeImageProvider(supabase,{prompt,size:'1024x1536',quality:process.env.IMAGE_AI_QUALITY||'medium',outputFormat:'png'});
        output={bytes:edge.bytes,mime:edge.mime,provider:edge.provider,model:edge.model,mode:'provider',estimatedCostUsd:edge.estimatedCostUsd??undefined,rawUsage:{...(edge.usage??{}),latency_ms:edge.latencyMs,quality:qualityTier,revised_prompt:edge.revisedPrompt??null,gateway:'supabase-edge'}};
      } else {
        output = (await generateProviderImage(prompt,qualityTier,supabase,project.organization_id,generation.id)) ?? {
          bytes:new TextEncoder().encode(developmentSvg(prompt, Number(scene), locale === 'en' ? 'en' : 'ar')),
          mime:'image/svg+xml', provider:'development', model:'svg-preview-v1', mode:'development'
        };
      }
    } catch (providerError) {
      if(!developmentFallbackAllowed()) throw providerError;
      output = {
        bytes:new TextEncoder().encode(developmentSvg(prompt, Number(scene), locale === 'en' ? 'en' : 'ar')),
        mime:'image/svg+xml', provider:'development', model:'svg-preview-v1', mode:'development'
      };
    }

    const ext = output.mime.includes('svg') ? 'svg' : output.mime.includes('jpeg') ? 'jpg' : 'png';
    const path = `${project.organization_id}/${project.id}/scene-${scene}/${generation.id}.${ext}`;
    const { error:uploadError } = await supabase.storage.from('generation-assets').upload(path, output.bytes, { contentType:output.mime, upsert:false });
    if (uploadError) throw uploadError;

    const { error:aErr } = await supabase.from('generation_assets').insert({ generation_id:generation.id, asset_type:'scene_image', storage_path:path, mime_type:output.mime, metadata:{ scene, mode:output.mode } });
    if (aErr) throw aErr;

    const now = new Date().toISOString();
    let charged=0;
    if(output.mode==='provider'){
      const credit=await chargeCredits({token,action:'image_scene',idempotencyKey:`image:${generation.id}`,referenceType:'generation',referenceId:generation.id,metadata:{projectId,scene}});
      charged=credit.credits;
    }
    const { error:uErr } = await supabase.from('generations').update({ status:'succeeded', provider_code:output.provider, model_code:output.model, response:{ storagePath:path, scene, mode:output.mode, quality:qualityTier }, credits_charged:charged, provider_cost_usd:output.estimatedCostUsd??null, completed_at:now }).eq('id',generation.id);
    if(output.mode==='provider') await recordGenerationCost({generationId:generation.id,organizationId:project.organization_id,providerCode:output.provider,modelCode:output.model,providerCostUsd:output.estimatedCostUsd,billableCredits:charged,rawUsage:output.rawUsage});
    if (uErr) throw uErr;

    const { data:signed, error:signedErr } = await supabase.storage.from('generation-assets').createSignedUrl(path, 60 * 60);
    if (signedErr) throw signedErr;

    return NextResponse.json({ generationId:generation.id, scene, imageUrl:signed.signedUrl, storagePath:path, mode:output.mode, quality:qualityTier, provider:output.provider, model:output.model });
  } catch (error) {
    if(isCreditError(error)) return NextResponse.json({error:'insufficient_credits'},{status:402});
    return NextResponse.json({ error:error instanceof Error ? error.message : 'Unknown error' }, { status:500 });
  }
}
