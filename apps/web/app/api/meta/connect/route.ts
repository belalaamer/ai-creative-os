import { NextResponse } from 'next/server';
import { getServerWorkspace } from '@/lib/supabase-server';
import { metaConfigured, metaOauthUrl, signMetaState } from '@/lib/meta';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { user, organizationId, role } = await getServerWorkspace();
  if (!user) return NextResponse.redirect(new URL('/auth?next=/meta', request.url));
  if (!organizationId) return NextResponse.redirect(new URL('/onboarding', request.url));
  if (role !== 'owner' && role !== 'admin') return NextResponse.redirect(new URL('/meta?error=admin_required', request.url));
  if (!metaConfigured()) return NextResponse.redirect(new URL('/meta?error=meta_not_configured', request.url));

  const state = await signMetaState({
    organizationId,
    userId: user.id,
    exp: Date.now() + 10 * 60 * 1000,
  });
  return NextResponse.redirect(metaOauthUrl(state));
}
