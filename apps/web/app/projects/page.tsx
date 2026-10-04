'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { LanguageToggle } from '@/components/language-toggle';
import { ArrowLeft, Clock3, FolderOpen, Sparkles } from 'lucide-react';

type Project={id:string;name:string;status:string;created_at:string;updated_at:string;brief:any};

export default function ProjectsPage(){
  const supabase=useMemo(()=>createClient(),[]); const router=useRouter(); const {t,locale}=useLanguage();
  const [projects,setProjects]=useState<Project[]>([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace('/auth');return;}const {data:activeOrg}=await supabase.rpc('get_active_organization');const m=activeOrg?{organization_id:String(activeOrg)}:null;if(!m){router.replace('/onboarding');return;}const {data}=await supabase.from('projects').select('id,name,status,created_at,updated_at,brief').eq('organization_id',m.organization_id).order('created_at',{ascending:false});setProjects((data??[]) as Project[]);setLoading(false);})()},[router,supabase]);
  return <main className="min-h-screen px-5 py-7"><div className="mx-auto max-w-6xl"><header className="flex items-center justify-between gap-3"><Link href="/dashboard" className="btn btn-ghost inline-flex items-center gap-2"><ArrowLeft size={16}/>{t('backDashboard')}</Link><LanguageToggle/></header><section className="mt-12"><div className="flex items-center gap-2 text-violet-300"><FolderOpen size={18}/><span>AI Creative OS</span></div><h1 className="mt-3 text-4xl font-black">{t('projectsTitle')}</h1><p className="mt-3 text-zinc-500">{t('projectsSubtitle')}</p></section>{loading?<div className="mt-10 text-zinc-500">{t('loading')}</div>:projects.length===0?<div className="card mt-8 p-8 text-center"><Sparkles className="mx-auto text-violet-300"/><div className="mt-4 font-bold">{t('noProjects')}</div><Link href="/dashboard" className="btn btn-primary mt-5 inline-flex">{t('createFirstProject')}</Link></div>:<section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{projects.map(p=><Link key={p.id} href={`/projects/${p.id}`} className="card p-5 transition hover:-translate-y-1 hover:border-violet-500/40"><div className="flex items-start justify-between gap-3"><div className="font-bold leading-6">{p.name}</div><span className="rounded-full border border-zinc-800 px-2 py-1 text-[11px] text-zinc-400">{p.status}</span></div><div className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-500">{p.brief?.request??t('projectNoBrief')}</div><div className="mt-5 flex items-center gap-2 text-xs text-zinc-600"><Clock3 size={14}/>{new Intl.DateTimeFormat(locale==='ar'?'ar-EG':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(p.created_at))}</div></Link>)}</section>}</div></main>;
}
