'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Building2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

type Org = { organization_id: string; role: string; organizations?: { name?: string } | null };

export function WorkspaceSwitcher() {
  const supabase=useMemo(()=>createClient(),[]);
  const {locale}=useLanguage();
  const ar=locale==='ar';
  const [items,setItems]=useState<Org[]>([]);
  const [active,setActive]=useState('');

  useEffect(()=>{(async()=>{
    const {data:{user}}=await supabase.auth.getUser();if(!user)return;
    const [{data:profile},{data:members}]=await Promise.all([
      supabase.from('profiles').select('active_organization_id').eq('user_id',user.id).single(),
      supabase.from('organization_members').select('organization_id,role,organizations(name)').eq('user_id',user.id)
    ]);
    setActive(profile?.active_organization_id||'');
    setItems((members||[]) as unknown as Org[]);
  })()},[supabase]);

  if(items.length<2)return null;

  const roleLabel=(role:string)=>ar?({owner:'مالك',admin:'مسؤول',editor:'محرر',viewer:'مشاهد'}[role]||role):role;

  return <label className="workspace-switcher">
    <Building2 size={15}/>
    <select aria-label={ar?'تغيير مساحة العمل':'Switch workspace'} value={active} onChange={async e=>{
      const id=e.target.value;
      const {error}=await supabase.rpc('set_active_organization',{p_organization_id:id});
      if(!error){setActive(id);window.location.reload();}
    }}>
      {items.map(x=><option key={x.organization_id} value={x.organization_id}>{x.organizations?.name||x.organization_id.slice(0,8)} · {roleLabel(x.role)}</option>)}
    </select>
  </label>;
}
