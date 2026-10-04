import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Missing server Supabase environment');
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireAdminContext(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const admin = createAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const { data: profile } = await admin.from('profiles').select('active_organization_id').eq('user_id', user.id).maybeSingle();
  let organizationId = profile?.active_organization_id as string | null | undefined;
  if (!organizationId) {
    const { data: fallback } = await admin.from('organization_members').select('organization_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
    organizationId = fallback?.organization_id;
  }
  if (!organizationId) throw Object.assign(new Error('No organization'), { status: 403 });

  const { data: membership } = await admin.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle();
  if (!membership) throw Object.assign(new Error('Forbidden'), { status: 403 });
  return { token, admin, user, organizationId, role: membership.role as 'owner'|'admin'|'editor'|'viewer' };
}

export function isOwnerOrAdmin(role: string) {
  return role === 'owner' || role === 'admin';
}

export function apiError(error: unknown) {
  const err = error as Error & { status?: number };
  return { message: err?.message || 'Unknown error', status: err?.status || 500 };
}
