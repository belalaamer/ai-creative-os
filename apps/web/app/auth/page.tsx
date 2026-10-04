'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';
import { LanguageToggle } from '@/components/language-toggle';

export default function AuthPage() {
  const router = useRouter(); const supabase = createClient(); const { t } = useLanguage();
  const nextPath=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('next'):null;
  const [mode,setMode]=useState<'login'|'signup'>('signup'); const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  async function submit(e: FormEvent){e.preventDefault();setBusy(true);setMessage('');try{if(mode==='signup'){const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name}}});if(error)throw error;if(data.session)router.push(nextPath||'/onboarding');else setMessage(t('accountCreated'));}else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;const {data:profile}=await supabase.from('profiles').select('onboarding_completed').single();router.push(nextPath||(profile?.onboarding_completed?'/dashboard':'/onboarding'));}}catch(err){setMessage(err instanceof Error?err.message:t('genericError'));}finally{setBusy(false)}}
  return <main className="min-h-screen px-6 py-14"><div className="mx-auto max-w-md"><div className="flex items-center justify-between"><Link href="/" className="text-zinc-400">← {t('home')}</Link><LanguageToggle/></div><div className="card mt-8 p-7"><h1 className="text-3xl font-black">{mode==='signup'?t('createAccount'):t('welcomeBack')}</h1><p className="mt-2 text-sm text-zinc-500">{t('workspaceHint')}</p><form onSubmit={submit} className="mt-7 space-y-4">{mode==='signup'&&<input className="input" placeholder={t('name')} value={name} onChange={e=>setName(e.target.value)} required/>}<input className="input" type="email" placeholder={t('email')} value={email} onChange={e=>setEmail(e.target.value)} required/><input className="input" type="password" placeholder={t('password')} minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/><button disabled={busy} className="btn btn-primary w-full">{busy?t('creating'):mode==='signup'?t('signup'):t('login')}</button></form>{message&&<div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm text-zinc-300">{message}</div>}<button onClick={()=>setMode(mode==='signup'?'login':'signup')} className="mt-5 w-full text-sm text-violet-300">{mode==='signup'?t('alreadyAccount'):t('newAccount')}</button></div></div></main>;
}
