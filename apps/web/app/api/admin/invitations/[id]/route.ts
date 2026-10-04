import { NextRequest, NextResponse } from 'next/server';
import { apiError, isOwnerOrAdmin, requireAdminContext } from '@/lib/server-admin';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin, user, organizationId, role } = await requireAdminContext(req);
    if (!isOwnerOrAdmin(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { data, error } = await admin.from('team_invitations').update({ status: 'revoked' }).eq('id', id).eq('organization_id', organizationId).eq('status', 'pending').select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, action: 'team.invite.revoked', entity_type: 'team_invitation', entity_id: id });
    return NextResponse.json({ ok: true });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
