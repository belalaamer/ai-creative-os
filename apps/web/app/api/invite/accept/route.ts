import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/server-admin';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const admin = createAdminClient();
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { token: inviteToken } = await req.json();
    if (!inviteToken) return NextResponse.json({ error: 'Missing invitation token' }, { status: 400 });
    const hash = createHash('sha256').update(String(inviteToken)).digest('hex');
    const { data: invite } = await admin.from('team_invitations').select('*').eq('token_hash', hash).eq('status', 'pending').maybeSingle();
    if (!invite) return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      await admin.from('team_invitations').update({ status: 'expired' }).eq('id', invite.id);
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
    }
    if ((user.email || '').toLowerCase() !== String(invite.email).toLowerCase()) return NextResponse.json({ error: 'Invitation email does not match this account' }, { status: 403 });

    const { error: memberError } = await admin.from('organization_members').upsert({ organization_id: invite.organization_id, user_id: user.id, role: invite.role }, { onConflict: 'organization_id,user_id', ignoreDuplicates: true });
    if (memberError) throw memberError;
    await admin.from('team_invitations').update({ status: 'accepted', accepted_by: user.id, accepted_at: new Date().toISOString() }).eq('id', invite.id);
    await admin.from('profiles').update({ active_organization_id: invite.organization_id, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    await admin.from('audit_logs').insert({ organization_id: invite.organization_id, actor_id: user.id, action: 'team.invite.accepted', entity_type: 'team_invitation', entity_id: invite.id, details: { role: invite.role } });
    return NextResponse.json({ ok: true, organizationId: invite.organization_id });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 }); }
}
