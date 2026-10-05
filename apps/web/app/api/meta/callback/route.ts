import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server-admin';
import { encryptMetaToken, exchangeMetaCode, metaConfigured, syncMetaConnection, verifyMetaState } from '@/lib/meta';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  try {
    if (!metaConfigured()) throw new Error('Meta integration is not configured');
    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');
    const oauthError = req.nextUrl.searchParams.get('error_description') || req.nextUrl.searchParams.get('error');
    if (oauthError) throw new Error(oauthError);
    if (!code || !state) throw new Error('Missing OAuth code or state');

    const payload = await verifyMetaState(state);
    const admin = createAdminClient();
    const { data: membership } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', payload.organizationId)
      .eq('user_id', payload.userId)
      .maybeSingle();
    if (!membership || !['owner','admin'].includes(membership.role)) throw new Error('Workspace access denied');

    const exchanged = await exchangeMetaCode(code);
    const scopes = (process.env.META_OAUTH_SCOPES || 'ads_read,ads_management,business_management,pages_show_list,pages_read_engagement,instagram_basic')
      .split(',').map(x=>x.trim()).filter(Boolean);
    const expiresAt = exchanged.expiresIn ? new Date(Date.now() + exchanged.expiresIn * 1000).toISOString() : null;

    const { data: connection, error } = await admin
      .from('meta_connections')
      .upsert({
        organization_id: payload.organizationId,
        meta_user_id: exchanged.profile.id,
        meta_user_name: exchanged.profile.name || null,
        status: 'connected',
        scopes,
        token_expires_at: expiresAt,
        created_by: payload.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' })
      .select('id')
      .single();
    if (error || !connection) throw error || new Error('Could not save Meta connection');

    const encrypted = await encryptMetaToken(exchanged.accessToken);
    const { error: credentialError } = await admin.rpc('set_meta_credential', {
      p_connection_id: connection.id,
      p_ciphertext: encrypted,
    });
    if (credentialError) throw credentialError;

    await syncMetaConnection({
      organizationId: payload.organizationId,
      connectionId: connection.id,
      accessToken: exchanged.accessToken,
    });

    return NextResponse.redirect(`${appUrl.replace(/\/$/,'')}/meta?connected=1`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Meta connection failed';
    const url = new URL('/meta', appUrl);
    url.searchParams.set('error', message.slice(0, 180));
    return NextResponse.redirect(url);
  }
}
