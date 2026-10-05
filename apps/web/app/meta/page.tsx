import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { MetaCenter } from '@/components/meta-center';
import { metaConfigured } from '@/lib/meta';
import { getServerWorkspace } from '@/lib/supabase-server';

export const dynamic='force-dynamic';

export default async function MetaPage(){
  const {supabase,user,organizationId,role}=await getServerWorkspace();
  if(!user)redirect('/auth?next=/meta');
  if(!organizationId)redirect('/onboarding');

  const [{data:connection},{data:accounts},{data:pages},{data:wallet}]=await Promise.all([
    supabase.from('meta_connections').select('id,status,meta_user_name,last_synced_at').eq('organization_id',organizationId).maybeSingle(),
    supabase.from('meta_ad_accounts').select('ad_account_id,name,currency,timezone_name,is_selected').eq('organization_id',organizationId).order('is_selected',{ascending:false}),
    supabase.from('meta_pages').select('page_id,name,instagram_business_account_id,instagram_username').eq('organization_id',organizationId).order('created_at'),
    supabase.from('credit_wallets').select('balance').eq('organization_id',organizationId).maybeSingle(),
  ]);

  return <AppShell credits={Number(wallet?.balance??0)}>
    <section className="meta-head"><div><div className="studio-eyebrow">META ADS</div><h1>Meta Ads Center</h1><p>Connect Facebook & Instagram advertising, read campaigns and performance, and bring paid-media decisions into the same creative workspace.</p></div></section>
    <MetaCenter configured={metaConfigured()} connected={connection?.status==='connected'} connectionName={connection?.meta_user_name??null} accounts={accounts??[]} pages={pages??[]} canAdmin={role==='owner'||role==='admin'}/>
  </AppShell>;
}
