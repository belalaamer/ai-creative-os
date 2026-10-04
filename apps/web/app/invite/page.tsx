'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { LanguageToggle } from '@/components/language-toggle';
import { useLanguage } from '@/lib/i18n';

export default function InvitePage() {
  const supabase = useMemo(() => createClient(), []); const router = useRouter(); const { t } = useLanguage();
  const [token,setToken]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [signedIn,setSignedIn]=useState(false);
  useEffect(()=>{setToken(new URLSearchParams(window.location.search).get('token')||'');supabase.auth.getUser().then(({data})=>setSignedIn(Boolean(data.user)));},[supabase]);
  async function accept(){setBusy(true);setMessage('');try{const {data:{session}}=await supabase.auth.getSession();if(!session){setMessage(t('inviteSignInFirst'));return;}const r=await fetch('/api/invite/accept',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({token})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Invite failed');setMessage(t('inviteAccepted'));setTimeout(()=>router.push('/dashboard'),600);}catch(e){setMessage(e instanceof Error?e.message:t('genericError'));}finally{setBusy(false)}}
  const loginHref=`/auth?next=${encodeURIComponent(`/invite?token=${token}`)}`;
  return <main className="min-h-screen px-6 py-14"><div className="mx-auto max-w-lg"><div className="flex items-center justify-between"><Link href="/" className="text-zinc-400">← {t('home')}</Link><LanguageToggle/></div><div className="card mt-8 p-7"><h1 className="text-3xl font-black">{t('inviteTitle')}</h1><p className="mt-2 text-zinc-500">{t('inviteSubtitle')}</p>{!token?<div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-red-300">{t('invalidInvite')}</div>:<div className="mt-6 space-y-4">{signedIn?<button className="btn btn-primary w-full" disabled={busy} onClick={accept}>{busy?t('creating'):t('acceptInvite')}</button>:<Link className="btn btn-primary block w-full text-center" href={loginHref}>{t('inviteSignIn')}</Link>}{message&&<div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm">{message}</div>}</div>}</div></div></main>;
}
