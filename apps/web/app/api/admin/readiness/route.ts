import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiError, isOwnerOrAdmin, requireAdminContext } from '@/lib/server-admin';
import { getProviderCandidates } from '@/lib/provider-router';
import { edgeTextProviderEnabled } from '@/lib/edge-text-provider';
import { edgeImageProviderEnabled, edgeSpeechProviderEnabled } from '@/lib/edge-media-provider';
import { edgeAssemblyGatewayEnabled, edgeVideoGatewayEnabled } from '@/lib/edge-video-provider';

function anyEnv(prefix: string) {
  return Boolean(process.env[`${prefix}_ENDPOINT`] && process.env[`${prefix}_API_KEY`]);
}

export async function GET(req: NextRequest) {
  try {
    const { admin, organizationId, role } = await requireAdminContext(req);
    if(!isOwnerOrAdmin(role)) return NextResponse.json({error:'Forbidden'},{status:403});
    const { data: providers } = await admin.from('organization_provider_settings').select('kind,quality_tier,env_prefix,enabled').eq('organization_id', organizationId).eq('enabled', true);
    const configured = (providers || []).map((p: any) => ({ ...p, secretReady: anyEnv(p.env_prefix) }));
    let edgeReadiness:any=null;
    if(edgeTextProviderEnabled() || edgeImageProviderEnabled() || edgeSpeechProviderEnabled() || edgeVideoGatewayEnabled() || edgeAssemblyGatewayEnabled()){
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
      if(url&&key&&token){
        const userClient=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
        const {data}=await userClient.functions.invoke('provider-readiness',{body:{}});
        edgeReadiness=data??null;
      }
    }
    const checks = [
      { key: 'supabase_public', ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) },
      { key: 'service_role', ok: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
      { key: 'app_url', ok: Boolean(process.env.APP_URL) },
      { key: 'text_provider', ok: Boolean(edgeReadiness?.openaiText?.apiKey && edgeReadiness?.openaiText?.model) || configured.some((x: any) => x.kind === 'text' && x.secretReady) || getProviderCandidates('text','quality').length>0 },
      { key: 'image_provider', ok: Boolean(edgeReadiness?.openaiImage?.apiKey && edgeReadiness?.openaiImage?.model) || configured.some((x: any) => x.kind === 'image' && x.secretReady) || getProviderCandidates('image','quality').length>0 },
      { key: 'audio_provider', ok: Boolean(edgeReadiness?.openaiSpeech?.apiKey && edgeReadiness?.openaiSpeech?.model) || configured.some((x: any) => x.kind === 'audio' && x.secretReady) || getProviderCandidates('audio','quality').length>0 },
      { key: 'video_provider', ok: Boolean(edgeReadiness?.video?.apiKey && edgeReadiness?.video?.model && edgeReadiness?.video?.createEndpoint) || configured.some((x: any) => x.kind === 'video' && x.secretReady) || getProviderCandidates('video','quality').length>0 },
      { key: 'assembly_provider', ok: Boolean(edgeReadiness?.assembly?.apiKey && edgeReadiness?.assembly?.endpoint) || Boolean(process.env.MEDIA_ASSEMBLY_ENDPOINT && process.env.MEDIA_ASSEMBLY_API_KEY) },
      { key: 'billing_provider', ok: Boolean(process.env.BILLING_PROVIDER_SECRET) },
    ];
    return NextResponse.json({ checks, providers: configured, edgeReadiness, readyForPrivateBeta: checks.filter(x => ['supabase_public','service_role','app_url','text_provider'].includes(x.key)).every(x => x.ok) });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
