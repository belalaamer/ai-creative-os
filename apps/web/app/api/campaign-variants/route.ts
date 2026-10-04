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

type Variant = { variantKey:'A'|'B'|'C'; title:string; angle:string; hook:string; primaryText:string; headline:string; cta:string; script:string; audience:string; rationale:string };
type Result = { variants:Variant[]; mode:'provider'|'development'; provider?:string; model?:string; estimatedCostUsd?:number; rawUsage?:Record<string,unknown> };

function developmentVariants(brief:any, locale:'ar'|'en'):Result {
  const ar=locale==='ar';
  const audience=brief?.audience || (ar?'الجمهور المستهدف':'Target audience');
  const offer=brief?.offer || '';
  return { mode:'development', variants:[
    { variantKey:'A', title:ar?'المشكلة والحل':'Problem / Solution', angle:ar?'ابدأ بالألم أو العائق ثم قدّم الحل بوضوح':'Lead with the pain point, then present the solution clearly', hook:brief?.hooks?.[0] || (ar?'المشكلة دي مأثرة عليك أكتر مما تتخيل.':'This problem is costing you more than you think.'), primaryText:ar?`لو ${audience} وبتواجه المشكلة دي، ركّز على النتيجة مش مجرد الخدمة. ${offer}`:`If you're ${audience} and dealing with this problem, focus on the outcome—not just the service. ${offer}`, headline:ar?'حل واضح لنتيجة أوضح':'A clearer path to the result', cta:ar?'اعرف أكتر':'Learn more', script:brief?.script||'', audience, rationale:ar?'مناسب للجمهور اللي عنده وعي بالمشكلة ويدور على حل.':'Best for problem-aware audiences actively looking for a solution.' },
    { variantKey:'B', title:ar?'العرض أولًا':'Offer First', angle:ar?'ابدأ بالقيمة أو العرض ثم فسّر لماذا هو مناسب الآن':'Lead with value or the offer, then explain why it matters now', hook:offer || (ar?'عرض قوي يستحق إنك تشوف تفاصيله.':'A strong offer worth a closer look.'), primaryText:ar?`القيمة هنا مش في الخصم وحده؛ المهم إن العرض يخدم احتياج ${audience}. ${offer}`:`The value is not just the discount; it is whether the offer solves a real need for ${audience}. ${offer}`, headline:ar?'قيمة أكبر بخطوة أبسط':'More value, simpler next step', cta:ar?'احجز الآن':'Book now', script:brief?.script||'', audience, rationale:ar?'مناسب للجمهور الدافئ أو اللي عنده نية شراء أعلى.':'Best for warmer audiences with higher purchase intent.' },
    { variantKey:'C', title:ar?'النتيجة والتحول':'Outcome / Transformation', angle:ar?'صوّر شكل الحياة أو النتيجة بعد حل المشكلة':'Show what life or performance looks like after the problem is solved', hook:brief?.hooks?.[2] || (ar?'تخيّل النتيجة لما المشكلة تبطل تعطلك.':'Imagine the result when this problem stops holding you back.'), primaryText:ar?`الإعلان هنا يبيع التحول: من الوضع الحالي إلى نتيجة أوضح وأكثر راحة. ${offer}`:`This version sells the transformation: from the current state to a clearer, better outcome. ${offer}`, headline:ar?'ابدأ التحول':'Start the transformation', cta:ar?'ابدأ الآن':'Get started', script:brief?.script||'', audience, rationale:ar?'مناسب للجمهور الأقل وعيًا بالمشكلة ويستجيب للنتيجة المرغوبة.':'Best for lower-awareness audiences motivated by the desired outcome.' }
  ] };
}

async function providerVariants(brief:any, locale:'ar'|'en', brandContext:any, quality:QualityTier, supabase:any, organizationId:string):Promise<Result|null>{
  const system=`You are a senior performance marketing strategist. Return JSON only with key variants, exactly 3 items. Each item: variantKey (A/B/C), title, angle, hook, primaryText, headline, cta, script, audience, rationale. The three variants MUST use meaningfully different persuasion angles suitable for A/B/C testing. Language: ${locale==='ar'?'Arabic':'English'}. Use only supported brand facts. Respect forbidden claims and legal notes. Brand context: ${JSON.stringify(brandContext)}.`;
  if(edgeTextProviderEnabled()){
    const response=await callEdgeTextProvider(supabase,{system,prompt:JSON.stringify(brief),jsonOnly:true,temperature:0.8});
    const parsed=parseJsonObject<any>(response.text); return {...parsed,mode:'provider',provider:response.provider,model:response.model,estimatedCostUsd:response.estimatedCostUsd??undefined,rawUsage:{...(response.usage??{}),latency_ms:response.latencyMs,quality,route:'supabase-edge'}} as Result;
  }
  const executed=await runProviderCandidates({supabase,organizationId,kind:'text',quality,run:async(config,signal)=>{
    const started=Date.now(); const response=await callTextProvider(config,{system,user:JSON.stringify(brief),signal,jsonOnly:true,temperature:0.8});
    const parsed=parseJsonObject<any>(response.text); const usage={...(response.usage??{}),latency_ms:Date.now()-started,quality}; return {...parsed,mode:'provider',provider:config.provider,model:config.model,estimatedCostUsd:estimateTextCostUsd(config,response.usage),rawUsage:usage} as Result;
  }}); return executed?.result??null;
}

export async function POST(req:NextRequest){
  try{
    const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,''); if(!token)return NextResponse.json({error:'Unauthorized'},{status:401});
    const {projectId,brief,locale='ar',quality='quality'}=await req.json(); const qualityTier=normalizeQuality(quality); if(!projectId||!brief)return NextResponse.json({error:'Missing project or brief'},{status:400});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; if(!url||!key)throw new Error('Missing Supabase environment');
    const supabase=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError}=await supabase.auth.getUser(token); if(userError||!user)return NextResponse.json({error:'Unauthorized'},{status:401});
    const {data:project,error:pErr}=await supabase.from('projects').select('id,organization_id,brand_id').eq('id',projectId).single(); if(pErr||!project)throw pErr??new Error('Project not found');
    const context=await loadBrandContext(supabase,project.brand_id); const compact=compactBrandContext(context);
    const {data:run,error:rErr}=await supabase.from('workflow_runs').insert({organization_id:project.organization_id,project_id:project.id,workflow_key:'campaign_variants_v1',status:'processing',input:{brief,locale,quality:qualityTier},created_by:user.id,started_at:new Date().toISOString()}).select('id').single(); if(rErr)throw rErr;
    const {data:step,error:sErr}=await supabase.from('workflow_steps').insert({workflow_run_id:run.id,step_key:'variants',sequence_no:1,status:'processing',input:{brief,locale,quality:qualityTier},started_at:new Date().toISOString()}).select('id').single(); if(sErr)throw sErr;
    const providerConfigured=edgeTextProviderEnabled() || (await resolveProviderCandidates(supabase,project.organization_id,'text',qualityTier)).length>0; if(providerConfigured)await quoteCredits(token,'campaign_variants'); if(!providerConfigured && !developmentFallbackAllowed())throw new Error('No text provider configured');
    const claimViolations=inspectClaims(JSON.stringify(brief),compact); for(const v of claimViolations) await recordModerationEvent({organizationId:project.organization_id,projectId:project.id,userId:user.id,ruleKey:v.ruleKey,severity:v.severity,matchedText:v.match}); if(claimViolations.some(v=>v.severity==='block'))return NextResponse.json({error:'blocked_claim',violations:claimViolations},{status:422});
    let result:Result; try{result=(await providerVariants(brief,locale,compact,qualityTier,supabase,project.organization_id))??developmentVariants(brief,locale);}catch(error){if(!developmentFallbackAllowed())throw error;result=developmentVariants(brief,locale)}
    const now=new Date().toISOString();
    const {data:generation,error:gErr}=await supabase.from('generations').insert({organization_id:project.organization_id,project_id:project.id,workflow_step_id:step.id,kind:'text',provider_code:result.mode==='provider'?(result.provider??'external'):'development',model_code:result.mode==='provider'?(result.model??null):'variants-rules-v1',status:'succeeded',prompt:{brief,locale,quality:qualityTier,brandContext:compact},response:result,credits_charged:0,created_by:user.id,completed_at:now}).select('id').single();
    if(gErr||!generation)throw gErr??new Error('Could not save generation');
    let charged=0;
    if(result.mode==='provider'){
      const credit=await chargeCredits({token,action:'campaign_variants',idempotencyKey:`campaign-variants:${generation.id}`,referenceType:'generation',referenceId:generation.id,metadata:{projectId}}); charged=credit.credits;
      await supabase.from('generations').update({credits_charged:charged,provider_cost_usd:result.estimatedCostUsd??null}).eq('id',generation.id);
      await recordGenerationCost({generationId:generation.id,organizationId:project.organization_id,providerCode:result.provider??'external',modelCode:result.model??'unknown',providerCostUsd:result.estimatedCostUsd,billableCredits:charged,rawUsage:result.rawUsage});
    }
    await supabase.from('campaign_variants').delete().eq('project_id',project.id);
    const rows=result.variants.map(v=>({organization_id:project.organization_id,project_id:project.id,brand_id:project.brand_id,variant_key:v.variantKey,title:v.title,angle:v.angle,hook:v.hook,primary_text:v.primaryText,headline:v.headline,cta:v.cta,script:v.script,audience:v.audience,rationale:v.rationale,mode:result.mode,provider_code:result.provider??null,model_code:result.model??null,generation_id:generation.id,metadata:{quality:qualityTier}}));
    const {error:vErr}=await supabase.from('campaign_variants').insert(rows); if(vErr)throw vErr;
    await Promise.all([
      supabase.from('workflow_steps').update({status:'succeeded',output:result,finished_at:now}).eq('id',step.id),
      supabase.from('workflow_runs').update({status:'succeeded',output:result,finished_at:now}).eq('id',run.id)
    ]);
    return NextResponse.json({variants:result.variants,mode:result.mode,creditsCharged:charged});
  }catch(error){if(isCreditError(error))return NextResponse.json({error:'insufficient_credits'},{status:402});return NextResponse.json({error:error instanceof Error?error.message:'Unknown error'},{status:500})}
}
