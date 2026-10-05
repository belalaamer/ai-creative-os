'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { LanguageToggle } from '@/components/language-toggle';

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export default function AuthPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { t, locale } = useLanguage();
  const ar = locale === 'ar';
  const [mode, setMode] = useState<'login'|'signup'>('signup');
  const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');

  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setMessage('');
    try{
      if(mode==='signup'){
        const nextPath=typeof window!=='undefined'?safeNextPath(new URLSearchParams(window.location.search).get('next')):null;
        const redirectTarget=nextPath||'/onboarding';
        const emailRedirectTo=typeof window!=='undefined'?`${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTarget)}`:undefined;
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name},...(emailRedirectTo?{emailRedirectTo}:{})}});
        if(error)throw error;
        if(data.session)router.push(redirectTarget);else setMessage(t('accountCreated'));
      }else{
        const {error}=await supabase.auth.signInWithPassword({email,password}); if(error)throw error;
        const {data:profile}=await supabase.from('profiles').select('onboarding_completed').single();
        const nextPath=typeof window!=='undefined'?safeNextPath(new URLSearchParams(window.location.search).get('next')):null;
        router.push(nextPath||(profile?.onboarding_completed?'/dashboard':'/onboarding'));
      }
    }catch(err){setMessage(err instanceof Error?err.message:t('genericError'));}finally{setBusy(false)}
  }

  return <main className="auth-shell">
    <section className="auth-story">
      <Link href="/" className="auth-brand"><span><Sparkles size={18}/></span><b>Creative OS</b></Link>
      <div className="auth-story-copy">
        <div className="studio-eyebrow">AI CREATIVE OPERATING SYSTEM</div>
        <h1>{ar?'كل اللي تحتاجه لصناعة إعلان، في مكان واحد.':'Everything you need to create an ad, in one place.'}</h1>
        <p>{ar?'Brand Brain، استراتيجية، نسخ A/B/C، صور، صوت وفيديو داخل Workflow واحد.':'Brand Brain, strategy, A/B/C variants, visuals, voice and video in one workflow.'}</p>
        <div className="auth-benefits">
          {(ar?['مساحة عمل خاصة','250 Credit تجريبي','Brand Brain مدمج']:['Private workspace','250 trial credits','Built-in Brand Brain']).map(x=><div key={x}><CheckCircle2 size={15}/><span>{x}</span></div>)}
        </div>
      </div>
      <div className="auth-orb one"/><div className="auth-orb two"/>
    </section>

    <section className="auth-panel">
      <div className="auth-panel-top"><Link href="/" className="auth-back"><ArrowLeft size={15} className="directional-icon"/>{t('home')}</Link><LanguageToggle/></div>
      <div className="auth-card">
        <div className="auth-tabs"><button className={mode==='signup'?'is-active':''} onClick={()=>setMode('signup')}>{t('signup')}</button><button className={mode==='login'?'is-active':''} onClick={()=>setMode('login')}>{t('login')}</button></div>
        <div className="auth-heading"><h2>{mode==='signup'?t('createAccount'):t('welcomeBack')}</h2><p>{t('workspaceHint')}</p></div>
        <form onSubmit={submit} className="auth-form">
          {mode==='signup'&&<label><span>{t('name')}</span><input className="input" value={name} onChange={e=>setName(e.target.value)} required/></label>}
          <label><span>{t('email')}</span><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
          <label><span>{t('password')}</span><input className="input" type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
          <button disabled={busy} className="auth-submit">{busy?t('creating'):mode==='signup'?t('signup'):t('login')}</button>
        </form>
        {message&&<div className="auth-message">{message}</div>}
      </div>
    </section>
  </main>;
}
