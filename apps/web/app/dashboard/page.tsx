import { redirect } from 'next/navigation';
import { DashboardStudio } from '@/components/dashboard-studio';
import { getServerWorkspace } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { supabase, user, organizationId } = await getServerWorkspace();
  if (!user) redirect('/auth');
  if (!organizationId) redirect('/onboarding');

  const [{ data: brand }, { data: wallet }, { data: meta }] = await Promise.all([
    supabase.from('brands').select('name').eq('organization_id', organizationId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('credit_wallets').select('balance').eq('organization_id', organizationId).maybeSingle(),
    supabase.from('meta_connections').select('status').eq('organization_id', organizationId).maybeSingle(),
  ]);

  if (!brand) redirect('/onboarding');

  return <DashboardStudio brandName={brand.name} wallet={Number(wallet?.balance ?? 0)} metaConnected={meta?.status === 'connected'} />;
}
