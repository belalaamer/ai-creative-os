'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrainCircuit, CheckCircle2, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { LanguageToggle } from '@/components/language-toggle';

export default function OnboardingPage(){
  const router=useRouter(); const supabase=useMemo(()=>createClient(),[]); const {t,locale}=useLanguage(); const ar=locale==='ar';
  const [orgId,setOrgId]=useState(''); const [name,setName]=useState(''); const [industry,setIndustry]=useState(''); const [description,setDescription]=useState(''); const [tone,setTone]=useState(''); const [busy,setBusy]=useState(true); const [error,setError]=useState('');
  useEffect(()=>{if(!tone)setTone(t('defaultTone'));},[t,tone]);
  useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace('/auth');return;}const {data,error}=await supabase.rpc('get_active_organization');if(error||!data){setError(error?.message||'No workspace');setBusy(false);return;}setOrgId(String(data));setBusy(false);})()},[router,supabase]);

  async function submit(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');
    const {data:{user}}=await supabase.auth.getUser();
    if(!user||!orgId){setError(t('authWorkspaceError'));setBusy(false);return;}
    const {error:brandError}=await supabase.from('brands').insert({organization_id:orgId,created_by:user.id,name,industry,description,tone_of_voice:{primary:tone},defaults:{language:locale,market:'EG'}});
    if(brandError){setError(brandError.message);setBusy(false);return;}
    const {error:profileError}=await supabase.from('profiles').update({onboarding_completed:true,locale}).eq('user_id',user.id);
    if(profileError){setError(profileError.message);setBusy(false);return;}
    router.push('/dashboard');
  }

  if(busy&&!orgId)return <main className="studio-loading"><Sparkles className="animate-pulse"/><span>{t('loadingWorkspace')}</span></main>;

  return <main className="onboarding-shell">
    <header className="onboarding-top"><div className="auth-brand"><span><Sparkles size={18}/></span><b>Creative OS</b></div><LanguageToggle/></header>
    <div className="onboarding-layout">
      <section className="onboarding-copy">
        <div className="studio-eyebrow">BRAND BRAIN SETUP</div>
        <h1>{t('tellBrand')}</h1>
        <p>{t('brandHelp')}</p>
        <div className="onboarding-benefits">
          <div><BrainCircuit size={18}/><span>{ar?'النظام هيفهم البراند قبل كل Generation':'The system understands your brand before every generation'}</span></div>
          <div><CheckCircle2 size={18}/><span>{ar?'البيانات دي بتدخل تلقائيًا في الـBrief والنسخ والمشاهد':'This context automatically powers briefs, variants and scenes'}</span></div>
        </div>
      </section>

      <form onSubmit={submit} className="onboarding-card">
        <div className="onboarding-step"><span>01</span><b>{t('onboardingStep')}</b></div>
        <label><span>{t('brandName')}</span><input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder={t('brandPlaceholder')} required/></label>
        <label><span>{t('industry')}</span><input className="input" value={industry} onChange={e=>setIndustry(e.target.value)} placeholder={t('industryPlaceholder')} required/></label>
        <label><span>{t('businessDescription')}</span><textarea className="input min-h-28" value={description} onChange={e=>setDescription(e.target.value)} placeholder={t('businessPlaceholder')}/></label>
        <label><span>{t('brandTone')}</span><input className="input" value={tone} onChange={e=>setTone(e.target.value)}/></label>
        {error&&<div className="creative-error">{error}</div>}
        <button className="auth-submit" disabled={busy}>{busy?t('saving'):t('saveEnter')}</button>
      </form>
    </div>
  </main>;
}
