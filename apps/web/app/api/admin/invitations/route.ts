import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { apiError, isOwnerOrAdmin, requireAdminContext } from '@/lib/server-admin';

export async function POST(req: NextRequest) {
  try {
    const { admin, user, organizationId, role } = await requireAdminContext(req);
    if (!isOwnerOrAdmin(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await admin.from('team_invitations').update({status:'expired'}).eq('organization_id',organizationId).eq('status','pending').lt('expires_at',new Date().toISOString());
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const inviteRole = String(body.role || 'viewer');
    if (!email || !['admin','editor','viewer'].includes(inviteRole)) return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 });

    const { data: subscription } = await admin.from('organization_subscriptions').select('plan_key').eq('organization_id', organizationId).maybeSingle();
    const { data: plan } = subscription?.plan_key ? await admin.from('billing_plans').select('included_seats').eq('plan_key', subscription.plan_key).maybeSingle() : { data: null } as any;
    const [{ count: memberCount }, { count: pendingCount }] = await Promise.all([
      admin.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId),
      admin.from('team_invitations').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('status', 'pending').gt('expires_at', new Date().toISOString()),
    ]);
    const seats = Number(plan?.included_seats ?? 1);
    if (Number(memberCount ?? 0) + Number(pendingCount ?? 0) >= seats) {
      return NextResponse.json({ error: 'seat_limit_reached', includedSeats: seats }, { status: 409 });
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invite, error } = await admin.from('team_invitations').insert({
      organization_id: organizationId, email, role: inviteRole, token_hash: tokenHash,
      invited_by: user.id, expires_at: expiresAt,
    }).select('id,email,role,status,expires_at,created_at').single();
    if (error) throw error;

    await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, action: 'team.invite.created', entity_type: 'team_invitation', entity_id: invite.id, details: { email, role: inviteRole } });
    const base = process.env.APP_URL || req.nextUrl.origin;
    return NextResponse.json({ invitation: invite, inviteUrl: `${base}/invite?token=${encodeURIComponent(token)}` });
  } catch (error) {
    const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
