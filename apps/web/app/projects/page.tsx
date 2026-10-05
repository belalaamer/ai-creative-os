'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import { Clock3, FolderOpen, Plus, Search, Sparkles } from 'lucide-react';

type Project={id:string;name:string;status:string;created_at:string;updated_at:string;brief:any};

export default function ProjectsPage(){
  const supabase=useMemo(()=>createClient(),[]); const router=useRouter(); const {t,locale}=useLanguage();
  const [projects,setProjects]=useState<Project[]>([]); const [loading,setLoading]=useState(true); const [query,setQuery]=useState('');
  useEffect(()=>{(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace('/auth');return;}const {data:activeOrg}=await supabase.rpc('get_active_organization');const m=activeOrg?{organization_id:String(activeOrg)}:null;if(!m){router.replace('/onboarding');return;}const {data}=await supabase.from('projects').select('id,name,status,created_at,updated_at,brief').eq('organization_id',m.organization_id).order('created_at',{ascending:false});setProjects((data??[]) as Project[]);setLoading(false);})()},[router,supabase]);

  const filtered=projects.filter(p=>!query.trim()||p.name.toLowerCase().includes(query.toLowerCase())||String(p.brief?.request||'').toLowerCase().includes(query.toLowerCase()));

  return <AppShell>
    <section>
      <div className="projects-head">
        <div><div className="studio-eyebrow">PROJECT LIBRARY</div><h1>{t('projectsTitle')}</h1><p>{t('projectsSubtitle')}</p></div>
        <Link href="/creative" className="new-project-btn"><Plus size={16}/>{locale==='ar'?'مشروع جديد':'New project'}</Link>
      </div>

      <div className="projects-toolbar">
        <label><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={locale==='ar'?'ابحث في المشاريع...':'Search projects...'}/></label>
        <span>{projects.length} {locale==='ar'?'مشروع':'projects'}</span>
      </div>

      {loading?<div className="mt-10 text-zinc-500">{t('loading')}</div>:projects.length===0?
        <div className="projects-empty"><Sparkles size={24}/><h3>{t('noProjects')}</h3><p>{locale==='ar'?'ابدأ أول Workflow وسيظهر هنا بكل نسخه وأصوله.':'Start your first workflow and it will appear here with its variants and assets.'}</p><Link href="/creative" className="creative-primary-action">{t('createFirstProject')}</Link></div>:
        filtered.length===0?<div className="projects-empty"><FolderOpen size={22}/><h3>{locale==='ar'?'لا توجد نتائج':'No matches found'}</h3><p>{locale==='ar'?'جرّب كلمة بحث مختلفة.':'Try a different search term.'}</p></div>:
        <div className="projects-grid">
          {filtered.map(p=><Link key={p.id} href={`/projects/${p.id}`} className="project-card">
            <div className="project-card-top"><div className="project-card-icon"><FolderOpen size={18}/></div><span>{p.status}</span></div>
            <h3>{p.name}</h3>
            <p>{p.brief?.request??t('projectNoBrief')}</p>
            <footer><span><Clock3 size={13}/>{new Intl.DateTimeFormat(locale==='ar'?'ar-EG':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(p.created_at))}</span><b>{locale==='ar'?'فتح المشروع':'Open project'}</b></footer>
          </Link>)}
        </div>}
    </section>
  </AppShell>;
}
