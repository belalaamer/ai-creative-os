import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server-admin';
import { getMetaAccessToken, syncMetaConnection } from '@/lib/meta';
import { getServerWorkspace } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { user, organizationId, role } = await getServerWorkspace();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!organizationId) return NextResponse.json({ error: 'No workspace' }, { status: 403 });
    if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Admin required' }, { status: 403 });

    const admin = createAdminClient();
    const { data: connection } = await admin.from('meta_connections').select('id').eq('organization_id', organizationId).maybeSingle();
    if (!connection) return NextResponse.json({ error: 'Meta not connected' }, { status: 404 });
    const token = await getMetaAccessToken(connection.id);
    const synced = await syncMetaConnection({ organizationId, connectionId: connection.id, accessToken: token });
    return NextResponse.json({ ok: true, ...synced });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Meta sync failed' }, { status: 500 });
  }
}
