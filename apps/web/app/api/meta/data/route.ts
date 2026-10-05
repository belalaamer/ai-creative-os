import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server-admin';
import { getMetaAccessToken, getMetaAccountInsights, getMetaCampaigns } from '@/lib/meta';
import { getServerWorkspace } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { user, organizationId } = await getServerWorkspace();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!organizationId) return NextResponse.json({ error: 'No workspace' }, { status: 403 });

    const admin = createAdminClient();
    const [{ data: connection }, { data: accounts }] = await Promise.all([
      admin.from('meta_connections').select('id,status').eq('organization_id', organizationId).maybeSingle(),
      admin.from('meta_ad_accounts').select('ad_account_id,name,currency,timezone_name,is_selected').eq('organization_id', organizationId).order('is_selected', { ascending: false }),
    ]);
    if (!connection || connection.status !== 'connected') return NextResponse.json({ error: 'Meta not connected' }, { status: 404 });

    const requested = req.nextUrl.searchParams.get('account');
    const account = accounts?.find((x:any)=>x.ad_account_id===requested) || accounts?.[0];
    if (!account) return NextResponse.json({ error: 'No ad account available' }, { status: 404 });

    const token = await getMetaAccessToken(connection.id);
    const [insights, campaigns] = await Promise.all([
      getMetaAccountInsights(account.ad_account_id, token),
      getMetaCampaigns(account.ad_account_id, token),
    ]);

    return NextResponse.json({ account, insights, campaigns: campaigns.slice(0, 50) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Meta data failed' }, { status: 500 });
  }
}
