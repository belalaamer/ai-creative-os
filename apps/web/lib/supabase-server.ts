import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase public environment variables');

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always mutate cookies. Auth refresh is handled by route handlers.
        }
      },
    },
  });
}

export async function getServerWorkspace() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, organizationId: null, role: null };

  const { data: activeOrg } = await supabase.rpc('get_active_organization');
  const organizationId = activeOrg ? String(activeOrg) : null;
  if (!organizationId) return { supabase, user, organizationId: null, role: null };

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    organizationId,
    role: membership?.role as 'owner' | 'admin' | 'editor' | 'viewer' | null,
  };
}
