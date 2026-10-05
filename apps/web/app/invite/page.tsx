'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Mail, Sparkles, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { LanguageToggle } from '@/components/language-toggle';
import { useLanguage } from '@/lib/i18n';

export default function InvitePage() {
  const supabase=useMemo(()=>createClient(),[]); const router=useRouter(); const {t,locale}=useLanguage(); const ar=locale==='ar';
  const [token,setToken]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [signedIn,setSignedIn]=useState(false); const [accepted,setAccepted]=useState(false);
  useEffect(()=>{setToken(new URLSearchParams(window.location.search).get('token')||'');supabase.auth.getUser().then(({data})=>setSignedIn(Boolean(data.user)));},[supabase]);
  async function accept(){setBusy(true);setMessage('');try{const {data:{session}}=await supabase.auth.getSession();if(!session){setMessage(t('inviteSignInFirst'));return;}const r=await fetch('/api/invite/accept',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({token})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Invite failed');setAccepted(true);setMessage(t('inviteAccepted'));setTimeout(()=>router.push('/dashboard'),900);}catch(e){setMessage(e instanceof Error?e.message:t('genericError'));}finally{setBusy(false)}}
  const loginHref=`/auth?next=${encodeURIComponent(`/invite?token=${token}`)}`;

  return <main className="invite-shell">
    <header className="invite-top"><Link href="/" className="auth-brand"><span><Sparkles size={18}/></span><b>Creative OS</b></Link><LanguageToggle/></header>
    <section className="invite-card">
      <div className="invite-icon">{accepted?<CheckCircle2 size={24}/>:<UserPlus size={24}/>}</div>
      <div className="studio-eyebrow">WORKSPACE INVITATION</div>
      <h1>{t('inviteTitle')}</h1>
      <p>{t('inviteSubtitle')}</p>

      {!token?<div className="invite-error">{t('invalidInvite')}</div>:<>
        <div className="invite-info"><Mail size={16}/><span>{ar?'سجّل بنفس البريد اللي وصلت له الدعوة لضمان ربط الحساب بمساحة العمل الصحيحة.':'Sign in with the email address that received the invitation so the workspace is linked correctly.'}</span></div>
        {signedIn?<button className="auth-submit" disabled={busy||accepted} onClick={accept}>{busy?t('creating'):accepted?t('inviteAccepted'):t('acceptInvite')}</button>:<Link className="auth-submit inline-flex items-center justify-center gap-2" href={loginHref}>{t('inviteSignIn')}<ArrowLeft size={15} className="directional-icon"/></Link>}
        {message&&<div className={accepted?'invite-message is-success':'invite-message'}>{message}</div>}
      </>}
    </section>
  </main>;
}
