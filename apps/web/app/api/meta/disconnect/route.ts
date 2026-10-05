import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server-admin';
import { getMetaAccessToken } from '@/lib/meta';
import { getServerWorkspace } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const { user, organizationId, role } = await getServerWorkspace();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!organizationId) return NextResponse.json({ error: 'No workspace' }, { status: 403 });
  if (role !== 'owner' && role !== 'admin') return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const admin = createAdminClient();
  const { data: connection } = await admin.from('meta_connections').select('id').eq('organization_id', organizationId).maybeSingle();
  if (!connection) return NextResponse.json({ ok: true });

  try {
    const token = await getMetaAccessToken(connection.id);
    const version = process.env.META_GRAPH_VERSION;
    if (version) await fetch(`https://graph.facebook.com/${version}/me/permissions?access_token=${encodeURIComponent(token)}`, { method: 'DELETE' });
  } catch {}

  await admin.from('meta_connections').delete().eq('id', connection.id);
  return NextResponse.json({ ok: true });
}
