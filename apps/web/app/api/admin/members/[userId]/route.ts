import { NextRequest, NextResponse } from 'next/server';
import { apiError, isOwnerOrAdmin, requireAdminContext } from '@/lib/server-admin';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { admin, user, organizationId, role } = await requireAdminContext(req);
    if (!isOwnerOrAdmin(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { userId } = await params; const body = await req.json(); const nextRole = String(body.role || 'viewer');
    if (!['admin','editor','viewer'].includes(nextRole)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    const { data: target } = await admin.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (target.role === 'owner') return NextResponse.json({ error: 'Owner role cannot be changed here' }, { status: 409 });
    const { error } = await admin.from('organization_members').update({ role: nextRole }).eq('organization_id', organizationId).eq('user_id', userId); if (error) throw error;
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, action: 'team.member.role_changed', entity_type: 'organization_member', entity_id: userId, details: { role: nextRole } });
    return NextResponse.json({ ok: true });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { admin, user, organizationId, role } = await requireAdminContext(req);
    if (!isOwnerOrAdmin(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { userId } = await params;
    if (userId === user.id) return NextResponse.json({ error: 'You cannot remove yourself here' }, { status: 409 });
    const { data: target } = await admin.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (target.role === 'owner') return NextResponse.json({ error: 'Owner cannot be removed' }, { status: 409 });
    const { error } = await admin.from('organization_members').delete().eq('organization_id', organizationId).eq('user_id', userId); if (error) throw error;
    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, action: 'team.member.removed', entity_type: 'organization_member', entity_id: userId });
    return NextResponse.json({ ok: true });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
