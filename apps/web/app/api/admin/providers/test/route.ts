import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiError, isOwnerOrAdmin, requireAdminContext } from '@/lib/server-admin';
import { normalizeQuality, resolveProviderCandidates, type ProviderKind } from '@/lib/provider-router';
import { callTextProvider } from '@/lib/provider-adapters';
import { safeProviderError } from '@/lib/runtime-policy';
import { edgeTextProviderEnabled } from '@/lib/edge-text-provider';

export async function POST(req: NextRequest) {
  try {
    const { admin, organizationId, role, user } = await requireAdminContext(req);
    if (!isOwnerOrAdmin(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const kind = String(body.kind || 'text') as ProviderKind;
    const quality = normalizeQuality(body.quality);
    if (kind !== 'text') return NextResponse.json({ error: 'Connection test currently supports text routes only' }, { status: 400 });

    if (edgeTextProviderEnabled()) {
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if(!url||!key) throw new Error('Missing Supabase public environment');
      const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
      if(!token) return NextResponse.json({error:'Unauthorized'},{status:401});
      const userClient=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
      const started=Date.now();
      const {data,error}=await userClient.functions.invoke('openai-text',{body:{system:'Return exactly OK.',prompt:'Connectivity test'}});
      const latency=Date.now()-started;
      if(error||!data?.text) return NextResponse.json({ok:false,provider:'openai',latencyMs:latency,error:error?.message||data?.error||'Gateway test failed'},{status:502});
      return NextResponse.json({ok:true,provider:data.provider||'openai',model:data.model||'configured-in-edge-secret',routeKey:'supabase-edge',latencyMs:latency,sample:String(data.text).slice(0,120)});
    }

    const candidates = await resolveProviderCandidates(admin, organizationId, kind, quality);
    const provider = candidates[0];
    if (!provider) return NextResponse.json({ error: 'No configured provider route' }, { status: 404 });

    const { data: run } = await admin.from('provider_test_runs').insert({
      organization_id: organizationId, kind, quality_tier: quality,
      provider_code: provider.provider, model_code: provider.model, route_key: provider.routeKey,
      status: 'started', created_by: user.id,
    }).select('id').single();

    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(provider.timeoutMs ?? 30000, 30000));
      let result;
      try {
        result = await callTextProvider(provider, {
          system: 'Return exactly one JSON object and no commentary.',
          user: '{"status":"ok"}',
          signal: controller.signal,
          jsonOnly: true,
          temperature: 0,
        });
      } finally { clearTimeout(timer); }
      const latency = Date.now() - started;
      if (run?.id) await admin.from('provider_test_runs').update({ status: 'succeeded', latency_ms: latency, finished_at: new Date().toISOString() }).eq('id', run.id);
      return NextResponse.json({ ok: true, provider: provider.provider, model: provider.model, routeKey: provider.routeKey, latencyMs: latency, sample: result.text.slice(0, 120) });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      const latency = Date.now() - started;
      const message = safeProviderError(error);
      if (run?.id) await admin.from('provider_test_runs').update({ status: timedOut ? 'timed_out' : 'failed', latency_ms: latency, error_message: message, finished_at: new Date().toISOString() }).eq('id', run.id);
      return NextResponse.json({ ok: false, provider: provider.provider, model: provider.model, latencyMs: latency, error: message }, { status: 502 });
    }
  } catch (error) {
    const e = apiError(error);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
