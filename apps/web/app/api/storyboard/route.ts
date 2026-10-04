import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chargeCredits, isCreditError, quoteCredits } from '@/lib/credits-server';
import { estimateTextCostUsd, resolveProviderCandidates, normalizeQuality, type QualityTier } from '@/lib/provider-router';
import { runProviderCandidates } from '@/lib/provider-execution';
import { inspectClaims } from '@/lib/claim-guard';
import { recordModerationEvent } from '@/lib/provider-telemetry';
import { recordGenerationCost } from '@/lib/generation-costs';
import { compactBrandContext, loadBrandContext } from '@/lib/brand-context';
import { callTextProvider, parseJsonObject } from '@/lib/provider-adapters';
import { developmentFallbackAllowed } from '@/lib/runtime-policy';
import { callEdgeTextProvider, edgeTextProviderEnabled } from '@/lib/edge-text-provider';

type Scene={scene:number;durationSeconds:number;shot:string;visualPrompt:string;voiceover:string;onScreenText:string};
type Storyboard={scenes:Scene[];mode:'provider'|'development';provider?:string;model?:string;estimatedCostUsd?:number;rawUsage?:Record<string,unknown>};

function developmentStoryboard(brief:any, locale:'ar'|'en'):Storyboard{
  const ar=locale==='ar'; const selected=brief?.selectedVariant; const hook=selected?.hook??brief?.hooks?.[0]??(ar?'ابدأ بسؤال قوي':'Start with a strong question');
  return {mode:'development',scenes:[
    {scene:1,durationSeconds:4,shot:ar?'لقطة افتتاحية سريعة مرتبطة بالمشكلة':'Fast opening shot tied to the problem',visualPrompt:ar?'لقطة سينمائية عمودية 9:16، حركة خفيفة، تركيز على المشكلة بصريًا، بدون نص داخل الصورة':'Cinematic vertical 9:16 shot, subtle motion, visually communicate the problem, no embedded text',voiceover:hook,onScreenText:hook},
    {scene:2,durationSeconds:5,shot:ar?'إظهار الحل أو الخدمة أثناء الاستخدام':'Show the solution or service in use',visualPrompt:ar?'مشهد واقعي احترافي للخدمة أثناء الاستخدام، إضاءة نظيفة، تكوين إعلاني، تفاصيل طبيعية':'Professional realistic scene of the service in use, clean lighting, commercial composition, natural details',voiceover:selected?.angle??brief?.angle??'',onScreenText:ar?'الحل المناسب يبدأ بفهم احتياجك':'The right solution starts with your real need'},
    {scene:3,durationSeconds:5,shot:ar?'إبراز الميزة أو العرض الرئيسي':'Highlight the core benefit or offer',visualPrompt:ar?'لقطة قريبة جذابة تبرز النتيجة أو الميزة الرئيسية، إحساس premium، مناسبة لإعلان Reels':'Attractive close-up emphasizing the main result or benefit, premium feel, suitable for a Reels ad',voiceover:selected?.primaryText??brief?.offer??'',onScreenText:brief?.offer??''},
    {scene:4,durationSeconds:4,shot:ar?'ختام واضح مع دعوة للإجراء':'Clear closing CTA shot',visualPrompt:ar?'مشهد ختامي نظيف به مساحة فارغة آمنة لإضافة CTA واللوجو في المونتاج، 9:16':'Clean closing frame with safe negative space for CTA and logo in post-production, 9:16',voiceover:selected?.cta??(ar?'خد الخطوة التالية دلوقتي.':'Take the next step now.'),onScreenText:selected?.cta??(ar?'ابدأ الآن':'Start now')}
  ]};
}

async function providerStoryboard(brief:any,locale:'ar'|'en',brandContext:any,quality:QualityTier,supabase:any,organizationId:string):Promise<Storyboard|null>{
  const system=`You are a senior ad director. Return JSON only: {"scenes":[{"scene":1,"durationSeconds":4,"shot":"","visualPrompt":"","voiceover":"","onScreenText":""}]}. Create 4-6 vertical ad scenes. Output language: ${locale==='ar'?'Arabic':'English'}. Visual prompts should be detailed and production-ready, avoid unsupported claims, and do not ask image models to render text. Brand context: ${JSON.stringify(brandContext)}.`;
  if(edgeTextProviderEnabled()){
    const result=await callEdgeTextProvider(supabase,{system,prompt:JSON.stringify(brief),jsonOnly:true,temperature:0.65});
    const parsed=parseJsonObject<any>(result.text); return {...parsed,mode:'provider',provider:result.provider,model:result.model,estimatedCostUsd:result.estimatedCostUsd??undefined,rawUsage:{...(result.usage??{}),latency_ms:result.latencyMs,quality,route:'supabase-edge'}} as Storyboard;
  }
  const executed=await runProviderCandidates({supabase,organizationId,kind:'text',quality,run:async(config,signal)=>{
    const started=Date.now();
    const result=await callTextProvider(config,{system,user:JSON.stringify(brief),signal,jsonOnly:true,temperature:0.65});
    const parsed=parseJsonObject<any>(result.text); const usage={...(result.usage??{}),latency_ms:Date.now()-started,quality}; return {...parsed,mode:'provider',provider:config.provider,model:config.model,estimatedCostUsd:estimateTextCostUsd(config,result.usage),rawUsage:usage} as Storyboard;
  }}); return executed?.result??null;
}

export async function POST(req:NextRequest){
  try{
    const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!token)return NextResponse.json({error:'Unauthorized'},{status:401});
    const {projectId,brief,variant=null,locale='ar',quality='quality'}=await req.json();const qualityTier=normalizeQuality(quality);if(!projectId||!brief)return NextResponse.json({error:'Missing project or brief'},{status:400});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)throw new Error('Missing Supabase environment');
    const supabase=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError}=await supabase.auth.getUser(token);if(userError||!user)return NextResponse.json({error:'Unauthorized'},{status:401});
    const {data:project,error:pErr}=await supabase.from('projects').select('id,organization_id,brand_id').eq('id',projectId).single();if(pErr||!project)throw pErr??new Error('Project not found');
    const brandContext=compactBrandContext(await loadBrandContext(supabase,project.brand_id));
    const creativeInput=variant?{...brief,selectedVariant:variant}:brief;
    const {data:run,error:rErr}=await supabase.from('workflow_runs').insert({organization_id:project.organization_id,project_id:project.id,workflow_key:'storyboard_v1',status:'processing',input:{brief,variant,locale,quality:qualityTier},created_by:user.id,started_at:new Date().toISOString()}).select('id').single();if(rErr)throw rErr;
    const {data:step,error:sErr}=await supabase.from('workflow_steps').insert({workflow_run_id:run.id,step_key:'storyboard',sequence_no:1,status:'processing',input:{brief,variant,locale,quality:qualityTier},started_at:new Date().toISOString()}).select('id').single();if(sErr)throw sErr;

    const providerConfigured=edgeTextProviderEnabled() || (await resolveProviderCandidates(supabase,project.organization_id,'text',qualityTier)).length>0;
    if(providerConfigured)await quoteCredits(token,'storyboard');
    if(!providerConfigured && !developmentFallbackAllowed())throw new Error('No text provider configured');
    const claimViolations=inspectClaims(JSON.stringify(creativeInput),brandContext); for(const v of claimViolations) await recordModerationEvent({organizationId:project.organization_id,projectId:project.id,userId:user.id,ruleKey:v.ruleKey,severity:v.severity,matchedText:v.match}); if(claimViolations.some(v=>v.severity==='block'))return NextResponse.json({error:'blocked_claim',violations:claimViolations},{status:422});
    let storyboard:Storyboard;try{storyboard=(await providerStoryboard(creativeInput,locale,brandContext,qualityTier,supabase,project.organization_id))??developmentStoryboard(creativeInput,locale);}catch(error){if(!developmentFallbackAllowed())throw error;storyboard=developmentStoryboard(creativeInput,locale)}
    const now=new Date().toISOString();
    const {data:generation,error:gErr}=await supabase.from('generations').insert({organization_id:project.organization_id,project_id:project.id,workflow_step_id:step.id,kind:'text',provider_code:storyboard.mode==='provider'?(storyboard.provider??'external'):'development',model_code:storyboard.mode==='provider'?(storyboard.model??null):'storyboard-rules-v1',status:'succeeded',prompt:{brief,variant,locale,quality:qualityTier,brandContext},response:storyboard,credits_charged:0,created_by:user.id,completed_at:now}).select('id').single();
    if(gErr||!generation)throw gErr??new Error('Could not save generation');
    let charged=0;
    if(storyboard.mode==='provider'){
      const credit=await chargeCredits({token,action:'storyboard',idempotencyKey:`storyboard:${generation.id}`,referenceType:'generation',referenceId:generation.id,metadata:{projectId}});
      charged=credit.credits; await supabase.from('generations').update({credits_charged:charged,provider_cost_usd:storyboard.estimatedCostUsd??null}).eq('id',generation.id); await recordGenerationCost({generationId:generation.id,organizationId:project.organization_id,providerCode:storyboard.provider??'external',modelCode:storyboard.model??'unknown',providerCostUsd:storyboard.estimatedCostUsd,billableCredits:charged,rawUsage:storyboard.rawUsage});
    }
    await Promise.all([
      supabase.from('workflow_steps').update({status:'succeeded',output:storyboard,finished_at:now}).eq('id',step.id),
      supabase.from('workflow_runs').update({status:'succeeded',output:storyboard,finished_at:now}).eq('id',run.id),
    ]);
    return NextResponse.json({workflowRunId:run.id,storyboard,creditsCharged:charged,quality:qualityTier});
  }catch(error){if(isCreditError(error))return NextResponse.json({error:'insufficient_credits'},{status:402});return NextResponse.json({error:error instanceof Error?error.message:'Unknown error'},{status:500})}
}
