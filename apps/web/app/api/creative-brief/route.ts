import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chargeCredits, isCreditError, quoteCredits } from '@/lib/credits-server';
import { estimateTextCostUsd, resolveProviderCandidates, getProviderConfig, normalizeQuality, type QualityTier } from '@/lib/provider-router';
import { runProviderCandidates } from '@/lib/provider-execution';
import { inspectClaims } from '@/lib/claim-guard';
import { recordModerationEvent } from '@/lib/provider-telemetry';
import { recordGenerationCost } from '@/lib/generation-costs';
import { compactBrandContext, loadBrandContext } from '@/lib/brand-context';
import { callTextProvider, parseJsonObject } from '@/lib/provider-adapters';
import { developmentFallbackAllowed } from '@/lib/runtime-policy';
import { callEdgeTextProvider, edgeTextProviderEnabled } from '@/lib/edge-text-provider';

type Brief = {
  objective: string; audience: string; angle: string; offer: string;
  hooks: string[]; concepts: { title: string; idea: string }[]; script: string;
  mode: 'provider' | 'development';
  provider?: string; model?: string; estimatedCostUsd?: number; rawUsage?: Record<string,unknown>;
};

function developmentBrief(prompt: string, locale: 'ar'|'en'): Brief {
  const ar = locale === 'ar';
  return {
    objective: ar ? 'توليد اهتمام وتحويله إلى إجراء واضح' : 'Generate attention and convert it into a clear action',
    audience: ar ? 'الجمهور المذكور في الطلب مع التركيز على المشكلة والنية الشرائية' : 'The audience described in the request, focused on pain points and buying intent',
    angle: ar ? 'مشكلة → نتيجة مرغوبة → إثبات/ميزة → دعوة للإجراء' : 'Problem → desired outcome → proof/benefit → call to action',
    offer: prompt,
    hooks: ar ? ['حاسس إنك بتضيّع فرصة لأن المشكلة دي لسه موجودة؟','قبل ما تختار الحل، شوف الفرق اللي لازم تدور عليه.','مش كل عرض قوي بيبدأ بخصم — أحيانًا بيبدأ بنتيجة واضحة.'] : ['Still losing opportunities because this problem is unresolved?','Before choosing a solution, look for the difference that actually matters.','A strong offer does not always start with a discount — it starts with a clear outcome.'],
    concepts: ar ? [
      {title:'Problem / Solution',idea:'ابدأ بموقف واقعي يوضح المشكلة ثم قدّم الخدمة باعتبارها الطريق الأقصر للنتيجة.'},
      {title:'Offer First',idea:'ابدأ بالعرض أو الميزة الرئيسية، ثم وضّح لمن يصلح ولماذا الآن.'},
      {title:'Outcome Story',idea:'قدّم الإعلان كسيناريو قبل/بعد يركز على التحول وليس على تفاصيل الخدمة فقط.'}
    ] : [
      {title:'Problem / Solution',idea:'Open with a relatable problem, then position the service as the shortest path to the desired result.'},
      {title:'Offer First',idea:'Lead with the offer or core benefit, then explain who it is for and why now.'},
      {title:'Outcome Story',idea:'Frame the ad as a before/after transformation rather than a list of service features.'}
    ],
    script: ar ? `Hook: المشكلة واضحة من أول ثانية.\nBody: اربط المشكلة بالنتيجة المطلوبة، وقدّم الميزة الأساسية بدون مبالغة.\nProof: استخدم دليلًا أو تفصيلة موثوقة من البراند.\nCTA: خليه إجراء واحد مباشر ومتوافق مع هدف الحملة.` : `Hook: Make the problem clear in the first second.\nBody: Connect the problem to the desired outcome and introduce the key benefit without exaggeration.\nProof: Use one credible proof point from the brand.\nCTA: Use one direct action aligned with the campaign objective.`,
    mode:'development'
  };
}

async function providerBrief(prompt: string, locale: 'ar'|'en', brandContext: any, quality: QualityTier, supabase:any, organizationId:string): Promise<Brief | null> {
  const system = `You are an advertising strategist. Return JSON only with keys objective, audience, angle, offer, hooks (3 strings), concepts (3 objects with title and idea), script. Output language: ${locale === 'ar' ? 'Arabic' : 'English'}. Brand context: ${JSON.stringify(brandContext)}. Do not invent unsupported claims.`;
  if (edgeTextProviderEnabled()) {
    const result = await callEdgeTextProvider(supabase,{system,prompt,jsonOnly:true,temperature:0.7});
    const parsed=parseJsonObject<any>(result.text);
    return {...parsed,mode:'provider',provider:result.provider,model:result.model,estimatedCostUsd:result.estimatedCostUsd??undefined,rawUsage:{...(result.usage??{}),latency_ms:result.latencyMs,quality,route:'supabase-edge'}} as Brief;
  }
  const executed = await runProviderCandidates({supabase,organizationId,kind:'text',quality,run:async(config,signal)=>{
    const started=Date.now();
    const result=await callTextProvider(config,{system,user:prompt,signal,jsonOnly:true,temperature:0.7});
    const parsed=parseJsonObject<any>(result.text); const usage={...(result.usage??{}),latency_ms:Date.now()-started,quality};
    return {...parsed,mode:'provider',provider:config.provider,model:config.model,estimatedCostUsd:estimateTextCostUsd(config,result.usage),rawUsage:usage} as Brief;
  }});
  return executed?.result ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if(!token) return NextResponse.json({error:'Unauthorized'},{status:401});
    const {prompt,locale='ar',quality='quality'}=await req.json(); const qualityTier=normalizeQuality(quality); if(!prompt?.trim())return NextResponse.json({error:'Prompt is required'},{status:400});
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; if(!url||!key)throw new Error('Missing Supabase environment');
    const supabase=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:userError}=await supabase.auth.getUser(token); if(userError||!user)return NextResponse.json({error:'Unauthorized'},{status:401});
    const {data:activeOrg,error:mErr}=await supabase.rpc('get_active_organization'); const membership=activeOrg?{organization_id:String(activeOrg)}:null; if(mErr||!membership)throw mErr??new Error('No organization');
    const {data:brand}=await supabase.from('brands').select('id').eq('organization_id',membership.organization_id).order('created_at',{ascending:true}).limit(1).maybeSingle();
    const brandContext=await loadBrandContext(supabase,brand?.id??null);
    const compactContext=compactBrandContext(brandContext);
    const {data:project,error:pErr}=await supabase.from('projects').insert({organization_id:membership.organization_id,brand_id:brand?.id??null,name:prompt.slice(0,80),status:'active',brief:{request:prompt,locale,quality:qualityTier},created_by:user.id}).select('id').single(); if(pErr)throw pErr;
    if(brand?.id){
      await supabase.from('brand_context_snapshots').insert({organization_id:membership.organization_id,brand_id:brand.id,project_id:project.id,context:compactContext,created_by:user.id});
    }
    const {data:run,error:rErr}=await supabase.from('workflow_runs').insert({organization_id:membership.organization_id,project_id:project.id,workflow_key:'creative_brief_v1',status:'processing',input:{prompt,locale,quality:qualityTier},created_by:user.id,started_at:new Date().toISOString()}).select('id').single(); if(rErr)throw rErr;
    const {data:step,error:sErr}=await supabase.from('workflow_steps').insert({workflow_run_id:run.id,step_key:'strategy',sequence_no:1,status:'processing',input:{prompt,locale,quality:qualityTier},started_at:new Date().toISOString()}).select('id').single(); if(sErr)throw sErr;

    const providerConfigured=edgeTextProviderEnabled() || (await resolveProviderCandidates(supabase,membership.organization_id,'text',qualityTier)).length>0;
    if(providerConfigured) await quoteCredits(token,'creative_brief');
    if(!providerConfigured && !developmentFallbackAllowed()) throw new Error('No text provider configured');

    const claimViolations=inspectClaims(prompt,compactContext);
    for(const v of claimViolations) await recordModerationEvent({organizationId:membership.organization_id,projectId:project.id,userId:user.id,ruleKey:v.ruleKey,severity:v.severity,matchedText:v.match});
    if(claimViolations.some(v=>v.severity==='block')) return NextResponse.json({error:'blocked_claim',violations:claimViolations},{status:422});
    let brief:Brief;
    try{brief=(await providerBrief(prompt,locale,compactContext,qualityTier,supabase,membership.organization_id))??developmentBrief(prompt,locale);}catch(error){if(!developmentFallbackAllowed())throw error;brief=developmentBrief(prompt,locale);}
    const now=new Date().toISOString();
    const {data:generation,error:gErr}=await supabase.from('generations').insert({organization_id:membership.organization_id,project_id:project.id,workflow_step_id:step.id,kind:'text',provider_code:brief.mode==='provider'?(brief.provider??'external'):'development',model_code:brief.mode==='provider'?(brief.model??null):'rules-v1',status:'succeeded',prompt:{prompt,locale,quality:qualityTier,brandContext:compactContext},response:brief,credits_charged:0,created_by:user.id,completed_at:now}).select('id').single();
    if(gErr||!generation)throw gErr??new Error('Could not save generation');

    let charged=0;
    if(brief.mode==='provider'){
      const credit=await chargeCredits({token,action:'creative_brief',idempotencyKey:`creative-brief:${generation.id}`,referenceType:'generation',referenceId:generation.id,metadata:{projectId:project.id}});
      charged=credit.credits;
      await supabase.from('generations').update({credits_charged:charged,provider_cost_usd:brief.estimatedCostUsd??null}).eq('id',generation.id);
      await recordGenerationCost({generationId:generation.id,organizationId:membership.organization_id,providerCode:brief.provider??'external',modelCode:brief.model??'unknown',providerCostUsd:brief.estimatedCostUsd,billableCredits:charged,rawUsage:brief.rawUsage});
    }

    await Promise.all([
      supabase.from('workflow_steps').update({status:'succeeded',output:brief,finished_at:now}).eq('id',step.id),
      supabase.from('workflow_runs').update({status:'succeeded',output:brief,finished_at:now}).eq('id',run.id),
      supabase.from('projects').update({brief:{request:prompt,locale,quality:qualityTier,strategy:brief}}).eq('id',project.id),
    ]);
    return NextResponse.json({projectId:project.id,workflowRunId:run.id,brief,creditsCharged:charged,quality:qualityTier});
  } catch(error) {
    if(isCreditError(error))return NextResponse.json({error:'insufficient_credits'},{status:402});
    return NextResponse.json({error:error instanceof Error?error.message:'Unknown error'},{status:500});
  }
}
